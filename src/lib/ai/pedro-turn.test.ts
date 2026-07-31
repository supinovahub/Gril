import { describe, expect, it } from "vitest";

import {
  appendProjectRecommendations,
  mergeQualificationValues,
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
      call_request: null,
      followup_strategy: "short",
      conversation_summary: { summary: "Lead confirmou orçamento.", facts: ["Orçamento confirmado"] },
    })).toThrow();
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
    expect(reply).toContain("R$ 700.000");
    expect(reply).not.toContain("Empreendimento pronto e aprovado");
  });
});
