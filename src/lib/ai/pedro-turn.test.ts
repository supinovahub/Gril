import { describe, expect, it } from "vitest";

import {
  hasSpecificFinancialProfile,
  isPedroQualificationComplete,
  mergeQualificationValues,
  normalizePedroCallRequest,
  PEDRO_QUALIFICATION_CODES,
  pedroTurnSchema,
  validatePedroDecision,
} from "./pedro-turn";

describe("pedroTurnSchema", () => {
  it("rejeita reply sem mensagem", () => {
    expect(() => pedroTurnSchema.parse({
      outcome: "reply",
      reply: null,
      escalation: null,
      qualification_updates: [],
      request_project_match: false,
      recommended_project_ids: [],
      project_media_requests: [],
      call_request: null,
      followup_strategy: "none",
      conversation_summary: { summary: "Lead pediu informações iniciais.", facts: [] },
    })).toThrow();
  });

  it("rejeita valor de qualificação incompatível com o tipo declarado", () => {
    expect(() => pedroTurnSchema.parse({
      outcome: "reply",
      reply: "Entendi.",
      escalation: null,
      qualification_updates: [{
        code: "total_price",
        value_kind: "number",
        value_text: "700 mil",
        value_number: 700_000,
        value_boolean: null,
        confidence: 0.9,
      }],
      request_project_match: false,
      recommended_project_ids: [],
      project_media_requests: [],
      call_request: null,
      followup_strategy: "short",
      conversation_summary: { summary: "Lead confirmou orçamento.", facts: ["Orçamento confirmado"] },
    })).toThrow();
  });

  it("aceita pedido estruturado de mídia e cadência de compra futura", () => {
    expect(pedroTurnSchema.parse({
      outcome: "reply",
      reply: "Posso enviar mais fotos ou o book completo. O que você prefere?",
      escalation: null,
      qualification_updates: [],
      request_project_match: true,
      recommended_project_ids: ["4c28007d-81bd-4c42-8b3e-7cc6e565b2e8"],
      project_media_requests: [{ project_id: "4c28007d-81bd-4c42-8b3e-7cc6e565b2e8", kind: "more_photos" }],
      call_request: null,
      followup_strategy: "future",
      conversation_summary: { summary: "Lead pediu material e informou compra futura.", facts: [] },
    })).toMatchObject({ followup_strategy: "future", project_media_requests: [{ kind: "more_photos" }] });
  });

  it("exige evidência e confiança contextual para escalar", () => {
    expect(pedroTurnSchema.parse({
      outcome: "escalate",
      reply: null,
      escalation: {
        category: "payment",
        reason: "O lead pediu a chave Pix para efetuar o sinal da reserva.",
        contextual_evidence: "Após escolher o imóvel, pediu explicitamente a chave Pix para pagar o sinal.",
        confidence: 0.96,
      },
      qualification_updates: [],
      request_project_match: false,
      recommended_project_ids: [],
      project_media_requests: [],
      call_request: null,
      followup_strategy: "cancel",
      conversation_summary: { summary: "Lead pediu instruções para pagar o sinal.", facts: [] },
    })).toMatchObject({ outcome: "escalate", escalation: { category: "payment", confidence: 0.96 } });

    expect(() => pedroTurnSchema.parse({
      outcome: "escalate",
      reply: null,
      escalation: {
        category: "payment",
        reason: "A palavra pagar apareceu.",
        contextual_evidence: "pagar",
        confidence: 0.5,
      },
      qualification_updates: [],
      request_project_match: false,
      recommended_project_ids: [],
      project_media_requests: [],
      call_request: null,
      followup_strategy: "cancel",
      conversation_summary: { summary: "Lead informou orçamento.", facts: [] },
    })).toThrow();
  });
});

describe("plano explícito do Pedro", () => {
  it("só conclui a qualificação depois dos sete tópicos comerciais", () => {
    const incomplete = new Map(PEDRO_QUALIFICATION_CODES.slice(0, -1).map((code) => [code, {
      code, valueText: "respondido", valueNumber: null, valueBoolean: null, state: "valid" as const,
    }]));
    expect(isPedroQualificationComplete(incomplete)).toBe(false);
    incomplete.set("purchase_timeline", {
      code: "purchase_timeline", valueText: null, valueNumber: null, valueBoolean: null, state: "unknown",
    });
    expect(isPedroQualificationComplete(incomplete)).toBe(true);
  });

  it("não considera um perfil financeiro vago específico", () => {
    const values = mergeQualificationValues([], [
      { code: "total_price", value_kind: "number", value_text: null, value_number: 900_000, value_boolean: null, confidence: 1 },
      { code: "down_payment", value_kind: "unknown", value_text: null, value_number: null, value_boolean: null, confidence: 1 },
    ]);
    expect(hasSpecificFinancialProfile(values)).toBe(false);
  });

  it("valida o projeto escolhido sem ampliar a decisão para outros projetos", () => {
    const vogel = "4c28007d-81bd-4c42-8b3e-7cc6e565b2e8";
    const turn = pedroTurnSchema.parse({
      outcome: "reply",
      reply: "Vou te mandar o book do Vogel.",
      escalation: null,
      qualification_updates: [],
      request_project_match: true,
      recommended_project_ids: [vogel],
      project_media_requests: [{ project_id: vogel, kind: "book" }],
      call_request: null,
      followup_strategy: "none",
      conversation_summary: { summary: "Lead pediu o book do Vogel.", facts: [] },
    });
    expect(validatePedroDecision({
      turn,
      qualificationDefinitions: [],
      activeProjectIds: [vogel, "a5681220-401d-422b-b731-19d5eb41efba"],
      approvedMedia: [{ project_id: vogel, media_type: "pdf" }],
      availableCallSlots: [],
    })).toEqual({ valid: true, errors: [] });
    expect(turn.project_media_requests).toEqual([{ project_id: vogel, kind: "book" }]);
  });

  it("bloqueia ação indisponível sem selecionar um substituto", () => {
    const unavailable = "4c28007d-81bd-4c42-8b3e-7cc6e565b2e8";
    const turn = pedroTurnSchema.parse({
      outcome: "reply",
      reply: "Vou te mandar o book.",
      escalation: null,
      qualification_updates: [],
      request_project_match: false,
      recommended_project_ids: [],
      project_media_requests: [{ project_id: unavailable, kind: "book" }],
      call_request: null,
      followup_strategy: "none",
      conversation_summary: { summary: "Lead pediu material.", facts: [] },
    });
    expect(validatePedroDecision({
      turn,
      qualificationDefinitions: [],
      activeProjectIds: [unavailable],
      approvedMedia: [],
      availableCallSlots: [],
    })).toEqual({ valid: false, errors: [`project_media_not_available:${unavailable}:book`] });
  });

  it("mantem o slot confirmado quando a ultima mensagem apenas escolhe o formato", () => {
    const request = { starts_at: "2026-08-04T17:00:00-03:00", format: "video" as const };
    const normalized = normalizePedroCallRequest(
      request,
      [
        { role: "user" as const, text: "Pode ser hoje as 16h" },
        { role: "assistant" as const, text: "Voce prefere video ou telefone?" },
        { role: "user" as const, text: "Por video" },
      ],
      { starts_at: "2026-08-04T16:00:00-03:00", status: "awaiting_manager" },
      Date.parse("2026-08-04T12:00:00-03:00"),
    );
    expect(normalized).toEqual({ starts_at: "2026-08-04T16:00:00-03:00", format: "video" });
  });
});
