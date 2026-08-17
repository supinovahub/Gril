import "server-only";

import { z } from "zod";

import { maskPersonaSample } from "../integrations/persona-analysis";
import { OpenAiRuntimeError } from "../integrations/openai-runtime";

const actionSchema = z.enum([
  "reply",
  "escalate",
  "ask_field",
  "ask_next_field",
  "answer_faq",
  "suggest_projects",
  "propose_call",
  "followup",
  "opt_out",
  "reschedule",
]);

const metaReviewFindingSchema = z.object({
  title: z.string().trim().min(3).max(180),
  failure_family: z.enum([
    "objection",
    "qualification",
    "faq",
    "tone",
    "scheduling",
    "escalation",
    "tooling",
    "knowledge",
    "other",
  ]),
  root_cause_layer: z.enum(["skill", "knowledge", "core_prompt", "runtime", "data", "unknown"]),
  severity: z.enum(["normal", "important", "critical"]),
  confidence: z.number().min(0).max(1),
  signal_ids: z.array(z.string().uuid()).min(1).max(80),
  observed_pattern: z.string().trim().min(5).max(4000),
  proposed_change: z.string().trim().min(5).max(4000),
  candidate_kind: z.enum(["case_only", "example", "potential_rule", "duplicate", "conflict", "technical"]),
  target_skill_code: z.string().trim().regex(/^[a-z0-9_]{3,80}$/).nullable(),
  regression: z.object({
    simulated_input: z.string().trim().min(1).max(2000),
    expected_response: z.string().trim().min(1).max(2000),
    allowed_actions: z.array(actionSchema).min(1).max(10),
    prohibited_actions: z.array(actionSchema).max(10),
  }),
});

const metaReviewSchema = z.object({
  findings: z.array(metaReviewFindingSchema).max(12),
});

const metaReviewTool = {
  type: "function",
  name: "commit_meta_review",
  description: "Registra padrões de falha e propostas pequenas para revisão humana. Nunca publica nem altera o agente.",
  strict: true,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      findings: {
        type: "array",
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            failure_family: {
              type: "string",
              enum: ["objection", "qualification", "faq", "tone", "scheduling", "escalation", "tooling", "knowledge", "other"],
            },
            root_cause_layer: {
              type: "string",
              enum: ["skill", "knowledge", "core_prompt", "runtime", "data", "unknown"],
            },
            severity: { type: "string", enum: ["normal", "important", "critical"] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            signal_ids: { type: "array", minItems: 1, maxItems: 80, items: { type: "string" } },
            observed_pattern: { type: "string" },
            proposed_change: { type: "string" },
            candidate_kind: {
              type: "string",
              enum: ["case_only", "example", "potential_rule", "duplicate", "conflict", "technical"],
            },
            target_skill_code: { type: ["string", "null"] },
            regression: {
              type: "object",
              additionalProperties: false,
              properties: {
                simulated_input: { type: "string" },
                expected_response: { type: "string" },
                allowed_actions: {
                  type: "array",
                  minItems: 1,
                  maxItems: 10,
                  items: { type: "string", enum: actionSchema.options },
                },
                prohibited_actions: {
                  type: "array",
                  maxItems: 10,
                  items: { type: "string", enum: actionSchema.options },
                },
              },
              required: ["simulated_input", "expected_response", "allowed_actions", "prohibited_actions"],
            },
          },
          required: [
            "title",
            "failure_family",
            "root_cause_layer",
            "severity",
            "confidence",
            "signal_ids",
            "observed_pattern",
            "proposed_change",
            "candidate_kind",
            "target_skill_code",
            "regression",
          ],
        },
      },
    },
    required: ["findings"],
  },
} as const;

const responseSchema = z.object({
  id: z.string().min(1),
  status: z.string(),
  model: z.string().optional(),
  output: z.array(z.object({
    type: z.string(),
    name: z.string().optional(),
    arguments: z.string().optional(),
  }).passthrough()).optional(),
  usage: z.object({
    input_tokens: z.number().int().nonnegative().optional(),
    output_tokens: z.number().int().nonnegative().optional(),
  }).optional(),
});

function maskReviewText(value: string) {
  return maskPersonaSample(value)
    .replace(/https?:\/\/\S+/gi, "[LINK]")
    .replace(/\b(?:[A-F0-9]{2}:){5}[A-F0-9]{2}\b/gi, "[IDENTIFICADOR]")
    .slice(0, 4000);
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[CONTEXTO_OMITIDO]";
  if (typeof value === "string") return maskReviewText(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 80).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 80)
        .map(([key, item]) => [key, sanitizeValue(item, depth + 1)]),
    );
  }
  return null;
}

export function sanitizeMetaReviewSignals(signals: unknown) {
  return sanitizeValue(signals);
}

export async function createMetaReview(input: {
  apiKey: string;
  model: string;
  reasoningEffort?: string | null;
  textVerbosity?: string | null;
  signals: unknown;
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
        instructions: [
          "Você é o revisor de melhoria contínua do Pedro. Analise somente as evidências anonimizadas desta organização.",
          "Agrupe sinais semanticamente repetidos e proponha mudanças pequenas, específicas e testáveis. Não trate um caso isolado normal como regra global; exceções críticas podem virar apenas caso de regressão.",
          "Diferencie falha de skill, conhecimento, dados, runtime e prompt core. Mudanças de core_prompt, runtime ou data devem ser classificadas como technical e nunca disfarçadas como instrução de atendimento.",
          "Use apenas os signal_ids recebidos. Não invente fatos, clientes, conversas ou evidências. Não inclua dados pessoais na saída.",
          "Cada proposta é somente um candidato para Lionel e revisão humana. Você não publica, não altera produção e não aprova a própria recomendação.",
          "Para target_skill_code, use snake_case estável quando uma skill modular for adequada; caso contrário use null.",
        ].join("\n"),
        input: [{
          role: "user",
          content: [{
            type: "input_text",
            text: JSON.stringify({ signals: sanitizeMetaReviewSignals(input.signals) }),
          }],
        }],
        max_output_tokens: 3000,
        tools: [metaReviewTool],
        tool_choice: { type: "function", name: metaReviewTool.name },
        parallel_tool_calls: false,
        ...(input.reasoningEffort && input.reasoningEffort !== "none"
          ? { reasoning: { effort: input.reasoningEffort } }
          : {}),
        text: { verbosity: input.textVerbosity ?? "low" },
      }),
    });
  } catch {
    throw new OpenAiRuntimeError(
      "openai_meta_review_unreachable",
      "A revisão automática não respondeu dentro do limite.",
      true,
    );
  }

  const raw = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new OpenAiRuntimeError(
      "openai_meta_review_invalid_json",
      "A revisão automática devolveu uma resposta inválida.",
      response.status >= 500,
    );
  }
  if (!response.ok) {
    throw new OpenAiRuntimeError(
      `openai_meta_review_http_${response.status}`,
      "A OpenAI recusou a revisão automática.",
      response.status === 429 || response.status >= 500,
    );
  }
  const parsed = responseSchema.safeParse(json);
  const call = parsed.success
    ? parsed.data.output?.find((item) => item.type === "function_call" && item.name === metaReviewTool.name)
    : null;
  if (!parsed.success || parsed.data.status !== "completed" || !call?.arguments) {
    throw new OpenAiRuntimeError(
      "openai_meta_review_incomplete",
      "A revisão automática não produziu achados estruturados.",
    );
  }
  let findings: z.infer<typeof metaReviewSchema>;
  try {
    findings = metaReviewSchema.parse(JSON.parse(call.arguments));
  } catch {
    throw new OpenAiRuntimeError(
      "openai_meta_review_arguments_invalid",
      "Os achados da revisão automática foram rejeitados pelo servidor.",
    );
  }
  return {
    findings: findings.findings,
    responseId: parsed.data.id,
    model: parsed.data.model ?? input.model,
    inputTokens: parsed.data.usage?.input_tokens ?? 0,
    outputTokens: parsed.data.usage?.output_tokens ?? 0,
  };
}
