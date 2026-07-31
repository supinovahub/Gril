import { z } from "zod";

const qualificationUpdateSchema = z
  .object({
    code: z.string().trim().regex(/^[a-z0-9_]+$/).max(80),
    value_kind: z.enum(["text", "number", "boolean", "refused", "unknown"]),
    value_text: z.string().trim().max(1000).nullable(),
    value_number: z.number().finite().nullable(),
    value_boolean: z.boolean().nullable(),
    confidence: z.number().min(0).max(1),
  })
  .superRefine((value, context) => {
    const populated = [value.value_text, value.value_number, value.value_boolean].filter(
      (item) => item !== null,
    ).length;
    if (["refused", "unknown"].includes(value.value_kind)) {
      if (populated !== 0) {
        context.addIssue({ code: "custom", message: "Estados sem valor não aceitam conteúdo." });
      }
      return;
    }
    if (populated !== 1 || value[`value_${value.value_kind}` as "value_text"] === null) {
      context.addIssue({ code: "custom", message: "A atualização deve conter exatamente o valor declarado." });
    }
  });

export const pedroTurnSchema = z
  .object({
    outcome: z.enum(["reply", "escalate"]),
    reply: z.string().trim().min(1).max(4096).nullable(),
    escalation: z
      .object({
        category: z.enum([
          "commercial_risk",
          "legal",
          "privacy",
          "fraud",
          "sensitive_document",
          "missing_approved_fact",
          "call_conflict",
          "human_requested",
          "other",
        ]),
        reason: z.string().trim().min(5).max(1000),
      })
      .nullable(),
    qualification_updates: z.array(qualificationUpdateSchema).max(8),
    request_project_match: z.boolean(),
    call_request: z
      .object({
        starts_at: z.string().datetime({ offset: true }),
        format: z.enum(["video", "phone", "unknown"]),
      })
      .nullable(),
    followup_strategy: z.enum(["none", "short", "long", "cancel"]),
    conversation_summary: z.object({
      summary: z.string().trim().min(1).max(2000),
      facts: z.array(z.string().trim().min(1).max(500)).max(20),
    }),
  })
  .superRefine((turn, context) => {
    if (turn.outcome === "reply" && !turn.reply) {
      context.addIssue({ code: "custom", path: ["reply"], message: "Uma resposta é obrigatória." });
    }
    if (turn.outcome === "escalate" && !turn.escalation) {
      context.addIssue({ code: "custom", path: ["escalation"], message: "A escalada é obrigatória." });
    }
  });

export type PedroTurn = z.infer<typeof pedroTurnSchema>;

export const pedroTurnTool = {
  type: "function",
  name: "commit_pedro_turn",
  description:
    "Registra uma única decisão comercial do Pedro. Use somente dados explicitamente informados pelo contato; ações críticas serão revalidadas pelo servidor.",
  strict: true,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      outcome: { type: "string", enum: ["reply", "escalate"] },
      reply: { type: ["string", "null"], description: "Mensagem curta em português brasileiro ou null ao escalar sem resposta automática." },
      escalation: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              category: {
                type: "string",
                enum: [
                  "commercial_risk",
                  "legal",
                  "privacy",
                  "fraud",
                  "sensitive_document",
                  "missing_approved_fact",
                  "call_conflict",
                  "human_requested",
                  "other",
                ],
              },
              reason: { type: "string" },
            },
            required: ["category", "reason"],
          },
        ],
      },
      qualification_updates: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            code: { type: "string" },
            value_kind: { type: "string", enum: ["text", "number", "boolean", "refused", "unknown"] },
            value_text: { type: ["string", "null"] },
            value_number: { type: ["number", "null"] },
            value_boolean: { type: ["boolean", "null"] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["code", "value_kind", "value_text", "value_number", "value_boolean", "confidence"],
        },
      },
      request_project_match: { type: "boolean" },
      call_request: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              starts_at: { type: "string", description: "Data e hora ISO 8601 com fuso, já confirmada explicitamente pelo contato." },
              format: { type: "string", enum: ["video", "phone", "unknown"] },
            },
            required: ["starts_at", "format"],
          },
        ],
      },
      followup_strategy: { type: "string", enum: ["none", "short", "long", "cancel"] },
      conversation_summary: {
        type: "object",
        additionalProperties: false,
        properties: {
          summary: { type: "string", description: "Resumo factual cumulativo e conciso da conversa, sem dados sensíveis." },
          facts: { type: "array", maxItems: 20, items: { type: "string" } },
        },
        required: ["summary", "facts"],
      },
    },
    required: [
      "outcome",
      "reply",
      "escalation",
      "qualification_updates",
      "request_project_match",
      "call_request",
      "followup_strategy",
      "conversation_summary",
    ],
  },
} as const;

export type QualificationValue = {
  code: string;
  valueText: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
};

export type ProjectCandidate = {
  id: string;
  name: string;
  region: string;
  neighborhood: string | null;
  summary: string;
  deliveryType: string;
  minPrice: number | null;
  minDownPayment: number | null;
  commercialPriority: number;
};

function normalizedText(value: string | null | undefined) {
  return value?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() ?? "";
}

export function mergeQualificationValues(
  current: QualificationValue[],
  updates: PedroTurn["qualification_updates"],
) {
  const merged = new Map(current.map((value) => [value.code, value]));
  for (const update of updates) {
    merged.set(update.code, {
      code: update.code,
      valueText: update.value_text,
      valueNumber: update.value_number,
      valueBoolean: update.value_boolean,
    });
  }
  return merged;
}

export function selectEligibleProjects(
  projects: ProjectCandidate[],
  values: Map<string, QualificationValue>,
  limit = 2,
) {
  const budget = values.get("total_price")?.valueNumber ?? null;
  const downPayment = values.get("down_payment")?.valueNumber ?? null;
  if (budget === null || downPayment === null) return [];
  const region = normalizedText(values.get("region")?.valueText);
  const delivery = normalizedText(values.get("delivery_preference")?.valueText);

  return projects
    .filter(
      (project) =>
        project.minPrice !== null &&
        project.minDownPayment !== null &&
        project.minPrice <= budget &&
        project.minDownPayment <= downPayment,
    )
    .sort((left, right) => {
      const leftRegion = normalizedText(`${left.region} ${left.neighborhood ?? ""}`).includes(region) ? 0 : 1;
      const rightRegion = normalizedText(`${right.region} ${right.neighborhood ?? ""}`).includes(region) ? 0 : 1;
      if (region && leftRegion !== rightRegion) return leftRegion - rightRegion;
      const leftDelivery = delivery && normalizedText(left.deliveryType) === delivery ? 0 : 1;
      const rightDelivery = delivery && normalizedText(right.deliveryType) === delivery ? 0 : 1;
      if (leftDelivery !== rightDelivery) return leftDelivery - rightDelivery;
      if (left.commercialPriority !== right.commercialPriority) return right.commercialPriority - left.commercialPriority;
      return (left.minPrice ?? 0) - (right.minPrice ?? 0);
    })
    .slice(0, limit);
}

export function appendProjectRecommendations(reply: string, projects: ProjectCandidate[]) {
  if (projects.length === 0) return reply;
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const options = projects.map((project) => {
    const location = [project.neighborhood, project.region].filter(Boolean).join(", ");
    return `${project.name} — ${location}; a partir de ${money.format(project.minPrice ?? 0)}; entrada mínima informada de ${money.format(project.minDownPayment ?? 0)}.`;
  });
  return `${reply}\n\nEncontrei estas opções compatíveis com os valores informados:\n${options.map((item) => `• ${item}`).join("\n")}`.slice(0, 4096);
}
