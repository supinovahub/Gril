import "server-only";

import { z } from "zod";

export class OpenAiRuntimeError extends Error {
  constructor(
    public readonly code: string,
    public readonly redactedMessage: string,
    public readonly retryable = false,
  ) {
    super(code);
    this.name = "OpenAiRuntimeError";
  }
}

const structuredTurn = z.object({
  action: z.enum(["reply", "escalate"]),
  reply: z.string().trim().max(4096).nullable(),
  escalation_reason: z.string().trim().max(1000).nullable(),
});

const responseSchema = z.object({
  id: z.string().min(1),
  status: z.string(),
  model: z.string().optional(),
  output_text: z.string().optional(),
  output: z.array(z.object({
    type: z.string(),
    content: z.array(z.object({ type: z.string(), text: z.string().optional(), refusal: z.string().optional() }).passthrough()).optional(),
  }).passthrough()).optional(),
  usage: z.object({ input_tokens: z.number().int().nonnegative().optional(), output_tokens: z.number().int().nonnegative().optional() }).optional(),
  error: z.object({ code: z.string().optional(), message: z.string().optional() }).nullable().optional(),
});

function outputText(response: z.infer<typeof responseSchema>) {
  if (response.output_text) return response.output_text;
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.refusal) throw new OpenAiRuntimeError("openai_refusal", "O modelo recusou esta resposta; a conversa foi encaminhada para revisão humana.");
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return null;
}

export async function createPedroResponse(input: {
  apiKey: string;
  model: string;
  reasoningEffort?: string | null;
  textVerbosity?: string | null;
  instructions: string;
  messages: Array<{ role: "user" | "assistant"; text: string }>;
}) {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
      headers: {
        authorization: `Bearer ${input.apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        store: false,
        instructions: input.instructions,
        input: input.messages.map((message) => ({
          role: message.role,
          content: [{ type: "input_text", text: message.text }],
        })),
        max_output_tokens: 1200,
        ...(input.reasoningEffort && input.reasoningEffort !== "none"
          ? { reasoning: { effort: input.reasoningEffort } }
          : {}),
        text: {
          verbosity: input.textVerbosity ?? "low",
          format: {
            type: "json_schema",
            name: "pedro_turn",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                action: { type: "string", enum: ["reply", "escalate"] },
                reply: { type: ["string", "null"] },
                escalation_reason: { type: ["string", "null"] },
              },
              required: ["action", "reply", "escalation_reason"],
            },
          },
        },
      }),
    });
  } catch {
    throw new OpenAiRuntimeError("openai_unreachable", "A OpenAI não respondeu dentro do limite.", true);
  }

  const raw = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new OpenAiRuntimeError("openai_invalid_json", "A OpenAI devolveu uma resposta inválida.", response.status >= 500);
  }
  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    throw new OpenAiRuntimeError(
      `openai_http_${response.status}`,
      retryable ? "A OpenAI está temporariamente indisponível." : "A OpenAI recusou a execução. Revise a chave e o modelo configurados.",
      retryable,
    );
  }
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success || parsed.data.status !== "completed") {
    throw new OpenAiRuntimeError("openai_response_incomplete", "A OpenAI não concluiu a resposta.", true);
  }
  const text = outputText(parsed.data);
  if (!text) throw new OpenAiRuntimeError("openai_output_missing", "A OpenAI concluiu sem devolver conteúdo.");
  let turn: z.infer<typeof structuredTurn>;
  try {
    turn = structuredTurn.parse(JSON.parse(text));
  } catch {
    throw new OpenAiRuntimeError("openai_structured_output_invalid", "A resposta estruturada do Pedro foi rejeitada pelo backend.");
  }
  if (turn.action === "reply" && !turn.reply) {
    throw new OpenAiRuntimeError("openai_reply_missing", "O Pedro não devolveu uma mensagem utilizável.");
  }
  return {
    responseId: parsed.data.id,
    model: parsed.data.model ?? input.model,
    inputTokens: parsed.data.usage?.input_tokens ?? 0,
    outputTokens: parsed.data.usage?.output_tokens ?? 0,
    outputText: turn.reply ?? "Atendimento humano solicitado.",
    structured: turn,
  };
}
