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
          "opt_out",
          "privacy_opt_out",
          "legal",
          "privacy",
          "fraud",
          "sensitive_document",
          "missing_approved_fact",
          "call_conflict",
          "human_requested",
          "payment",
          "identity_question",
          "wrong_number",
          "origin_contested",
          "unsupported_language",
          "abuse",
          "discrimination",
          "other",
        ]),
        reason: z.string().trim().min(5).max(1000),
        contextual_evidence: z.string().trim().min(3).max(1000),
        confidence: z.number().min(0.8).max(1),
      })
      .nullable(),
    qualification_updates: z.array(qualificationUpdateSchema).max(8),
    request_project_match: z.boolean(),
    recommended_project_ids: z.array(z.string().uuid()),
    project_media_requests: z.array(
      z.object({
        project_id: z.string().uuid(),
        kind: z.enum(["principal", "more_photos", "book"]),
      }),
    ),
    call_request: z
      .object({
        starts_at: z.string().datetime({ offset: true }),
        format: z.enum(["video", "phone", "unknown"]),
      })
      .nullable(),
    followup_strategy: z.enum(["none", "short", "long", "future", "cancel"]),
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
    if (turn.request_project_match !== (turn.recommended_project_ids.length > 0)) {
      context.addIssue({
        code: "custom",
        path: ["recommended_project_ids"],
        message: "A decisão de match e a lista exata de empreendimentos devem ser coerentes.",
      });
    }
    if (new Set(turn.recommended_project_ids).size !== turn.recommended_project_ids.length) {
      context.addIssue({ code: "custom", path: ["recommended_project_ids"], message: "Não repita empreendimentos." });
    }
    const mediaKeys = turn.project_media_requests.map((item) => `${item.project_id}:${item.kind}`);
    if (new Set(mediaKeys).size !== mediaKeys.length) {
      context.addIssue({ code: "custom", path: ["project_media_requests"], message: "Não repita a mesma ação de mídia." });
    }
    if (turn.outcome === "escalate" && (
      turn.qualification_updates.length > 0
      || turn.request_project_match
      || turn.project_media_requests.length > 0
      || turn.call_request !== null
    )) {
      context.addIssue({
        code: "custom",
        path: ["outcome"],
        message: "Uma escalada não pode carregar outras ações comerciais.",
      });
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
                  "opt_out",
                  "privacy_opt_out",
                  "legal",
                  "privacy",
                  "fraud",
                  "sensitive_document",
                  "missing_approved_fact",
                  "call_conflict",
                  "human_requested",
                  "payment",
                  "identity_question",
                  "wrong_number",
                  "origin_contested",
                  "unsupported_language",
                  "abuse",
                  "discrimination",
                  "other",
                ],
              },
              reason: { type: "string" },
              contextual_evidence: {
                type: "string",
                description: "Evidência curta que justifica a escalada após considerar a conversa completa, nunca uma palavra isolada.",
              },
              confidence: {
                type: "number",
                minimum: 0.8,
                maximum: 1,
                description: "Confiança contextual. Abaixo de 0,8, responda ou esclareça em vez de escalar.",
              },
            },
            required: ["category", "reason", "contextual_evidence", "confidence"],
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
      recommended_project_ids: {
        type: "array",
        items: { type: "string", description: "UUID exato de um empreendimento ativo presente no contexto aprovado." },
        description: "Lista exata, escolhida pelo Pedro, dos empreendimentos envolvidos nesta resposta. Vazia quando não houver match.",
      },
      project_media_requests: {
        type: "array",
        description: "Ações exatas de mídia escolhidas pelo Pedro. O executor não selecionará, ampliará ou substituirá projetos.",
        items: {
            type: "object",
            additionalProperties: false,
            properties: {
              project_id: { type: "string", description: "UUID de um empreendimento ativo presente no contexto aprovado." },
              kind: { type: "string", enum: ["principal", "more_photos", "book"] },
            },
            required: ["project_id", "kind"],
        },
      },
      call_request: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              starts_at: { type: "string", description: "Instante ISO 8601 de um slot aprovado e confirmado pelo contato. Copie literalmente o starts_at fornecido pelo backend; nunca converta ou altere o offset." },
              format: { type: "string", enum: ["video", "phone", "unknown"] },
            },
            required: ["starts_at", "format"],
          },
        ],
      },
      followup_strategy: { type: "string", enum: ["none", "short", "long", "future", "cancel"] },
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
      "recommended_project_ids",
      "project_media_requests",
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
  state?: "valid" | "refused" | "unknown";
};

export const PEDRO_QUALIFICATION_CODES = [
  "purchase_objective",
  "region",
  "down_payment",
  "monthly_installment",
  "total_price",
  "delivery_preference",
  "purchase_timeline",
] as const;

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

export function isPedroQualificationComplete(values: Map<string, QualificationValue>) {
  return PEDRO_QUALIFICATION_CODES.every((code) => values.has(code));
}

export function hasSpecificFinancialProfile(values: Map<string, QualificationValue>) {
  const totalPrice = values.get("total_price");
  const downPayment = values.get("down_payment");
  return totalPrice?.state !== "refused"
    && totalPrice?.state !== "unknown"
    && totalPrice?.valueNumber !== null
    && totalPrice?.valueNumber !== undefined
    && downPayment?.state !== "refused"
    && downPayment?.state !== "unknown"
    && downPayment?.valueNumber !== null
    && downPayment?.valueNumber !== undefined;
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
      ...(update.value_kind === "refused" || update.value_kind === "unknown" ? { state: update.value_kind } : {}),
    });
  }
  return merged;
}

export type PedroDecisionValidationInput = {
  turn: PedroTurn;
  qualificationDefinitions: Array<{ code: string; answerType: string }>;
  activeProjectIds: string[];
  approvedMedia: Array<{ project_id: string; media_type: string }>;
  availableCallSlots: Array<{ starts_at: string }>;
  existingCallStartsAt?: string | null;
};

type PedroConversationMessage = { role: "user" | "assistant"; text: string };
type ExistingCallSlot = { starts_at: string; status: string };

function normalizeSchedulingText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function extractSchedulingClockTimes(value: string) {
  const normalized = normalizeSchedulingText(value);
  return Array.from(normalized.matchAll(/\b([01]?\d|2[0-3])(?::([0-5]\d)|h(?:([0-5]\d))?)\b/g), (match) => {
    const hour = Number(match[1]);
    const minute = Number(match[2] ?? match[3] ?? "0");
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  });
}

function hasSchedulingCommitment(value: string) {
  const normalized = normalizeSchedulingText(value);
  return /\b(?:separei|agendei|marquei|solicitei|(?:deixei|ficou|foi)\b[^.!?]{0,60}\b(?:separad[oa]|solicitad[oa]|agendad[oa]|marcad[oa]))\b/.test(normalized);
}

function operationLocalClock(startsAt: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  }).formatToParts(new Date(startsAt));
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;
  return hour && minute ? `${hour}:${minute}` : null;
}

export function formatPedroCallSlotForOperation(startsAt: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(startsAt));
}

export function hasCallDecisionTemporalMismatch(
  reply: string | null | undefined,
  request: PedroTurn["call_request"],
  timezone: string,
) {
  if (!reply) return false;
  const mentionedTimes = extractSchedulingClockTimes(reply);
  if (!request) return mentionedTimes.length > 0 && hasSchedulingCommitment(reply);
  if (mentionedTimes.length === 0) return false;
  const requestLocalClock = operationLocalClock(request.starts_at, timezone);
  return !requestLocalClock || !mentionedTimes.includes(requestLocalClock);
}

function isFormatOnlyCallConfirmation(
  messages: PedroConversationMessage[],
  existingCall: ExistingCallSlot | null,
  now: number,
) {
  if (!existingCall || ["completed", "no_show", "cancelled"].includes(existingCall.status)) return false;
  if (new Date(existingCall.starts_at).valueOf() <= now) return false;
  const userMessages = messages.filter((message) => message.role === "user");
  const latest = normalizeSchedulingText(userMessages.at(-1)?.text ?? "");
  const context = normalizeSchedulingText(userMessages.slice(-4).map((message) => message.text).join(" "));
  const latestChoosesFormat = /\b(video|ligacao|whatsapp|telefone|celular)\b/.test(latest);
  const latestAddsNewSlot = /\b(?:[01]?\d|2[0-3])(?::[0-5]\d|h(?:[0-5]\d)?)\b/.test(latest)
    || /\b(hoje|amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo|\d{1,2}[/-]\d{1,2})\b/.test(latest);
  const priorTime = /\b(?:[01]?\d|2[0-3])(?::[0-5]\d|h(?:[0-5]\d)?)\b/.test(context);
  return latestChoosesFormat && !latestAddsNewSlot && priorTime;
}

export function normalizePedroCallRequest(
  request: PedroTurn["call_request"],
  messages: PedroConversationMessage[],
  existingCall: ExistingCallSlot | null,
  now = Date.now(),
) {
  if (request && isFormatOnlyCallConfirmation(messages, existingCall, now)) {
    return { ...request, starts_at: existingCall!.starts_at };
  }
  return request;
}

export function hasFutureCallTemporalContradiction(
  reply: string | null | undefined,
  existingCall: ExistingCallSlot | null,
  now = Date.now(),
) {
  if (!reply || !existingCall || ["completed", "no_show", "cancelled"].includes(existingCall.status)) return false;
  if (new Date(existingCall.starts_at).valueOf() <= now) return false;
  const normalized = normalizeSchedulingText(reply);
  return /\bja\s+passou\b/.test(normalized)
    || /\b(?:horario|hora|slot)\b[^.!?]{0,40}\bpassou\b/.test(normalized);
}

export function validatePedroDecision(input: PedroDecisionValidationInput) {
  const errors: string[] = [];
  const definitions = new Map(input.qualificationDefinitions.map((item) => [item.code, item.answerType]));
  const activeProjects = new Set(input.activeProjectIds);

  for (const update of input.turn.qualification_updates) {
    const answerType = definitions.get(update.code);
    if (!answerType) {
      errors.push(`qualification_definition_not_found:${update.code}`);
      continue;
    }
    if (["refused", "unknown"].includes(update.value_kind)) continue;
    if (["money", "number"].includes(answerType) && update.value_kind !== "number") {
      errors.push(`qualification_type_mismatch:${update.code}`);
    } else if (answerType === "boolean" && update.value_kind !== "boolean") {
      errors.push(`qualification_type_mismatch:${update.code}`);
    } else if (!["money", "number", "boolean"].includes(answerType) && update.value_kind !== "text") {
      errors.push(`qualification_type_mismatch:${update.code}`);
    }
  }

  for (const projectId of input.turn.recommended_project_ids) {
    if (!activeProjects.has(projectId)) errors.push(`project_not_available:${projectId}`);
  }

  for (const request of input.turn.project_media_requests) {
    if (!activeProjects.has(request.project_id)) {
      errors.push(`project_not_available:${request.project_id}`);
      continue;
    }
    const requiredType = request.kind === "book" ? "pdf" : request.kind === "principal" ? "cover" : "image";
    if (!input.approvedMedia.some((item) => item.project_id === request.project_id && item.media_type === requiredType)) {
      errors.push(`project_media_not_available:${request.project_id}:${request.kind}`);
    }
  }

  if (input.turn.call_request) {
    const requestedAt = new Date(input.turn.call_request.starts_at).valueOf();
    const exactSlotExists = input.availableCallSlots.some(
      (slot) => new Date(slot.starts_at).valueOf() === requestedAt,
    ) || (input.existingCallStartsAt
      ? new Date(input.existingCallStartsAt).valueOf() === requestedAt
      : false);
    if (!exactSlotExists) errors.push(`call_slot_not_available:${input.turn.call_request.starts_at}`);
  }

  return { valid: errors.length === 0, errors };
}
