import "server-only";

import { z } from "zod";
import { OpenAiRuntimeError } from "./openai-runtime";

const analysisSchema = z.object({
  greeting_patterns: z.array(z.string().max(160)).max(10),
  vocabulary_patterns: z.array(z.string().max(160)).max(20),
  sentence_style: z.string().max(1000),
  emoji_style: z.string().max(500),
  persuasion_style: z.string().max(1000),
  boundaries_observed: z.array(z.string().max(300)).max(15),
  anonymized_examples: z.array(z.string().max(500)).max(8),
});

const analysisTool = {
  type: "function", name: "commit_persona_analysis",
  description: "Extrai apenas padrões de comunicação, sem preservar dados pessoais ou fatos comerciais da conversa.",
  strict: true,
  parameters: {
    type: "object", additionalProperties: false,
    properties: {
      greeting_patterns: { type: "array", maxItems: 10, items: { type: "string" } },
      vocabulary_patterns: { type: "array", maxItems: 20, items: { type: "string" } },
      sentence_style: { type: "string" }, emoji_style: { type: "string" }, persuasion_style: { type: "string" },
      boundaries_observed: { type: "array", maxItems: 15, items: { type: "string" } },
      anonymized_examples: { type: "array", maxItems: 8, items: { type: "string" } },
    },
    required: ["greeting_patterns", "vocabulary_patterns", "sentence_style", "emoji_style", "persuasion_style", "boundaries_observed", "anonymized_examples"],
  },
} as const;

export function maskPersonaSample(value: string) {
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[EMAIL]")
    .replace(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4}/g, "[TELEFONE]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[DOCUMENTO]")
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/\d{4}-?\d{2}\b/g, "[DOCUMENTO]")
    .replace(/\b(?:R\$\s*)?\d{1,3}(?:\.\d{3})*(?:,\d{2})?\b/g, "[VALOR]");
}

export async function analyzePersonaSample(input: { apiKey: string; model: string; maskedText: string }) {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(45_000),
      headers: { authorization: `Bearer ${input.apiKey}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        model: input.model, store: false,
        instructions: "Analise somente padrões de comunicação em português brasileiro. Não reconstrua nem infira dados pessoais. Exemplos devem permanecer anonimizados.",
        input: [{ role: "user", content: [{ type: "input_text", text: input.maskedText }] }],
        max_output_tokens: 1200, tools: [analysisTool], tool_choice: { type: "function", name: analysisTool.name }, parallel_tool_calls: false,
      }),
    });
  } catch { throw new OpenAiRuntimeError("persona_analysis_unreachable", "A OpenAI não respondeu à análise da amostra.", true); }
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new OpenAiRuntimeError(`persona_analysis_http_${response.status}`, "A OpenAI recusou a análise da amostra.", response.status === 429 || response.status >= 500);
  const parsed = z.object({ status: z.string(), output: z.array(z.object({ type: z.string(), name: z.string().optional(), arguments: z.string().optional() }).passthrough()) }).safeParse(json);
  const call = parsed.success ? parsed.data.output.find((item) => item.type === "function_call" && item.name === analysisTool.name) : null;
  if (!parsed.success || parsed.data.status !== "completed" || !call?.arguments) throw new OpenAiRuntimeError("persona_analysis_incomplete", "A análise não produziu padrões válidos.");
  try { return analysisSchema.parse(JSON.parse(call.arguments)); }
  catch { throw new OpenAiRuntimeError("persona_analysis_invalid", "Os padrões extraídos foram rejeitados pelo servidor."); }
}
