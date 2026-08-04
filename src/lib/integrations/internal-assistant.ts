import "server-only";

import { z } from "zod";

import { OpenAiRuntimeError } from "./openai-runtime";

const responseSchema = z.object({
  id: z.string(),
  status: z.string(),
  output_text: z.string().optional(),
  output: z.array(z.object({
    type: z.string(),
    content: z.array(z.object({
      type: z.string(),
      text: z.string().optional(),
      refusal: z.string().optional(),
    }).passthrough()).optional(),
  }).passthrough()).optional(),
  usage: z.object({
    input_tokens: z.number().int().nonnegative().optional(),
    output_tokens: z.number().int().nonnegative().optional(),
  }).optional(),
});

function extractText(response: z.infer<typeof responseSchema>) {
  if (response.output_text?.trim()) return response.output_text.trim();
  const parts: string[] = [];
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.refusal) throw new OpenAiRuntimeError("openai_refusal", "O assistente recusou esta resposta.");
      if (content.text?.trim()) parts.push(content.text.trim());
    }
  }
  if (!parts.length) throw new OpenAiRuntimeError("openai_text_missing", "O assistente concluiu sem produzir uma resposta.");
  return parts.join("\n\n");
}

export async function createInternalAssistantResponse(input: {
  apiKey: string;
  model: string;
  reasoningEffort?: string | null;
  textVerbosity?: string | null;
  assistant: "pedro" | "lionel";
  messages: Array<{ role: "user" | "assistant"; text: string }>;
  context: Record<string, unknown>;
}) {
  const instructions = input.assistant === "pedro"
    ? `Você é Pedro, copiloto operacional interno de uma imobiliária. Converse com donos e gestores em português brasileiro, de forma direta e transparente. Analise o contexto fornecido sem inventar fatos. Quando houver uma decisão, apresente uma proposta concreta e peça confirmação explícita. Não diga que executou nenhuma ação: neste chat você apenas orienta, resume conflitos e prepara o próximo passo. Se a questão implicar uma regra permanente, diga que ela precisa passar pela curadoria do Lionel.`
    : `Você é Lionel, curador geral do sistema Pedro. Seu objetivo é impedir que uma nova regra, exemplo, aprendizado ou mudança técnica entre sem contexto suficiente. Conduza um grill interno com uma pergunta por vez. Classifique o pedido como caso isolado, exemplo útil, regra potencial, duplicidade, conflito ou problema técnico. Verifique escopo, duração, exceções, prioridade e impacto. Nunca afirme que publicou código ou banco. Para problemas técnicos, produza ao final um prompt sanitizado com problema, evidência, resultado esperado e critérios de aceitação, sem chaves, tokens ou dados pessoais.`;

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
        instructions,
        input: [
          ...input.messages.map((message) => ({ role: message.role, content: message.text })),
          { role: "user", content: `CONTEXTO INTERNO (fonte de verdade):\n${JSON.stringify(input.context)}` },
        ],
        max_output_tokens: 1800,
        ...(input.reasoningEffort && input.reasoningEffort !== "none"
          ? { reasoning: { effort: input.reasoningEffort } }
          : {}),
        text: { verbosity: input.textVerbosity ?? "low" },
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
    throw new OpenAiRuntimeError(
      `openai_http_${response.status}`,
      response.status === 429 || response.status >= 500
        ? "A OpenAI está temporariamente indisponível."
        : "A OpenAI recusou a execução. Revise a chave e o modelo configurados.",
      response.status === 429 || response.status >= 500,
    );
  }
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success || parsed.data.status !== "completed") {
    throw new OpenAiRuntimeError("openai_response_incomplete", "A OpenAI não concluiu a resposta.", true);
  }
  return {
    responseId: parsed.data.id,
    text: extractText(parsed.data),
    inputTokens: parsed.data.usage?.input_tokens ?? 0,
    outputTokens: parsed.data.usage?.output_tokens ?? 0,
  };
}
