import { describe, expect, it } from "vitest";

import {
  appendProjectRecommendations,
  hasSpecificFinancialProfile,
  inferProjectMaterialIntent,
  isPedroQualificationComplete,
  mergeQualificationValues,
  PEDRO_QUALIFICATION_CODES,
  pedroTurnSchema,
  selectEligibleProjects,
  type ProjectCandidate,
} from "./pedro-turn";

const projects: ProjectCandidate[] = [
  {
    id: "1",
    name: "Centro Alto",
    region: "São Paulo",
    neighborhood: "Pinheiros",
    summary: "Empreendimento pronto e aprovado.",
    deliveryType: "ready",
    minPrice: 700_000,
    minDownPayment: 140_000,
    commercialPriority: 60,
  },
  {
    id: "2",
    name: "Praia Sul",
    region: "Santos",
    neighborhood: "Gonzaga",
    summary: "Empreendimento em lançamento.",
    deliveryType: "launch",
    minPrice: 650_000,
    minDownPayment: 120_000,
    commercialPriority: 90,
  },
  {
    id: "3",
    name: "Fora do orçamento",
    region: "São Paulo",
    neighborhood: null,
    summary: "Não deve ser oferecido.",
    deliveryType: "ready",
    minPrice: 1_500_000,
    minDownPayment: 300_000,
    commercialPriority: 100,
  },
];

describe("pedroTurnSchema", () => {
  it("rejeita reply sem mensagem", () => {
    expect(() => pedroTurnSchema.parse({
      outcome: "reply",
      reply: null,
      escalation: null,
      qualification_updates: [],
      request_project_match: false,
      project_media_request: null,
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
      project_media_request: null,
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
      request_project_match: false,
      project_media_request: { project_id: "4c28007d-81bd-4c42-8b3e-7cc6e565b2e8", kind: "more_photos" },
      call_request: null,
      followup_strategy: "future",
      conversation_summary: { summary: "Lead pediu material e informou compra futura.", facts: [] },
    })).toMatchObject({ followup_strategy: "future", project_media_request: { kind: "more_photos" } });
  });
});

describe("curadoria determinística", () => {
  it("não recomenda sem preço total e entrada", () => {
    expect(selectEligibleProjects(projects, new Map())).toEqual([]);
  });

  it("aplica limites financeiros e usa preferências apenas para ordenar", () => {
    const values = mergeQualificationValues([], [
      { code: "total_price", value_kind: "number", value_text: null, value_number: 800_000, value_boolean: null, confidence: 1 },
      { code: "down_payment", value_kind: "number", value_text: null, value_number: 150_000, value_boolean: null, confidence: 1 },
      { code: "region", value_kind: "text", value_text: "Pinheiros", value_number: null, value_boolean: null, confidence: 1 },
      { code: "delivery_preference", value_kind: "text", value_text: "ready", value_number: null, value_boolean: null, confidence: 1 },
    ]);
    expect(selectEligibleProjects(projects, values).map((project) => project.id)).toEqual(["1", "2"]);
  });

  it("acrescenta apenas fatos estruturados ao texto", () => {
    const reply = appendProjectRecommendations("Separei duas opções.", projects.slice(0, 1));
    expect(reply).toContain("Centro Alto");
    expect(reply).toContain("Pinheiros, São Paulo");
    expect(reply).not.toContain("700.000");
    expect(reply).not.toContain("Empreendimento pronto e aprovado");
  });

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

  it("distingue books, capas e fotos adicionais pela intenção explícita", () => {
    expect(inferProjectMaterialIntent({ latestLeadMessage: "Quais opções vocês têm disponíveis?" })).toBe("books");
    expect(inferProjectMaterialIntent({ latestLeadMessage: "Pode mandar umas fotos?" })).toBe("principal_photos");
    expect(inferProjectMaterialIntent({ latestLeadMessage: "Quero ver mais fotos" })).toBe("more_photos");
    expect(inferProjectMaterialIntent({ latestLeadMessage: "Até 7 mil de parcela está bom" })).toBe("none");
    expect(inferProjectMaterialIntent({ latestLeadMessage: "Sim", previousPedroMessage: "Quer ver o book completo?" })).toBe("books");
  });
});
