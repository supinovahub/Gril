import "server-only";

import { z } from "zod";

import { OpenAiRuntimeError } from "./openai-runtime";

const transcriptionSchema = z.object({ text: z.string() });
const responseSchema = z.object({ status: z.string(), output_text: z.string().optional() });

async function checkedJson(response: Response) {
  const raw = await response.text();
  let json: unknown;
  try { json = JSON.parse(raw); } catch {
    throw new OpenAiRuntimeError("openai_media_invalid_json", "A OpenAI devolveu uma resposta de mídia inválida.", response.status >= 500);
  }
  if (!response.ok) {
    throw new OpenAiRuntimeError(`openai_media_http_${response.status}`, "A OpenAI não conseguiu interpretar a mídia recebida.", response.status === 429 || response.status >= 500);
  }
  return json;
}

export async function extractMediaText(input: {
  apiKey: string;
  model: string;
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
  contentType: string;
}) {
  if (input.contentType === "audio") {
    const form = new FormData();
    form.set("model", "gpt-4o-mini-transcribe");
    form.set("language", "pt");
    const fileBytes = input.bytes.buffer.slice(
      input.bytes.byteOffset,
      input.bytes.byteOffset + input.bytes.byteLength,
    ) as ArrayBuffer;
    form.set("file", new File([fileBytes], input.fileName, { type: input.mimeType }));
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST", headers: { authorization: `Bearer ${input.apiKey}` }, body: form,
        cache: "no-store", signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new OpenAiRuntimeError("openai_transcription_unreachable", "A transcrição do áudio não respondeu no limite.", true);
    }
    const parsed = transcriptionSchema.safeParse(await checkedJson(response));
    if (!parsed.success) throw new OpenAiRuntimeError("openai_transcription_invalid", "A transcrição do áudio não devolveu texto válido.");
    return parsed.data.text.trim().slice(0, 4096);
  }

  if (input.contentType === "image") {
    const dataUrl = `data:${input.mimeType};base64,${Buffer.from(input.bytes).toString("base64")}`;
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST", cache: "no-store", signal: AbortSignal.timeout(60_000),
        headers: { authorization: `Bearer ${input.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: input.model, store: false, max_output_tokens: 800,
          instructions: "Transcreva objetivamente todo texto legível e descreva apenas fatos visíveis relevantes para um atendimento imobiliário. Não infira dados ausentes. Responda em português brasileiro.",
          input: [{ role: "user", content: [{ type: "input_text", text: "Interprete esta imagem recebida pelo lead." }, { type: "input_image", image_url: dataUrl }] }],
          text: { verbosity: "low" },
        }),
      });
    } catch {
      throw new OpenAiRuntimeError("openai_vision_unreachable", "A leitura da imagem não respondeu no limite.", true);
    }
    const parsed = responseSchema.safeParse(await checkedJson(response));
    if (!parsed.success || parsed.data.status !== "completed" || !parsed.data.output_text?.trim()) {
      throw new OpenAiRuntimeError("openai_vision_invalid", "A leitura da imagem não devolveu texto válido.");
    }
    return parsed.data.output_text.trim().slice(0, 4096);
  }

  return null;
}
