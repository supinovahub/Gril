import { describe, expect, it } from "vitest";

import { compilePedroInstructions, PEDRO_BEHAVIOR_V3_MARKER } from "./pedro-instructions";

describe("compilePedroInstructions", () => {
  it("carrega os invariantes comportamentais e o pacote publicado", () => {
    const instructions = compilePedroInstructions("Persona publicada", { opt_out: "immediate" }, { company: "Studio" });
    expect(instructions).toContain(PEDRO_BEHAVIOR_V3_MARKER);
    expect(instructions).toContain("Persona publicada");
    expect(instructions).toContain("você é a única fonte da decisão comercial e conversacional");
    expect(instructions).toContain("não uma autorização para o executor completar a lista");
    expect(instructions).toContain("Nunca envie capa automaticamente");
    expect(instructions).toContain("aproximadamente 15 minutos");
    expect(instructions).toContain("nunca que está confirmado");
    expect(instructions).toContain("Não repita campos já preenchidos");
    expect(instructions).toContain("Nunca classifique por palavra isolada");
    expect(instructions).toContain("As regras rígidas limitam o que você pode executar");
    expect(instructions).toContain("Você pode tratar orçamento, entrada, parcelas, financiamento");
    expect(instructions).toContain("book, planta e material imobiliário não são sensíveis");
    expect(PEDRO_BEHAVIOR_V3_MARKER).toBe("GRIL_BEHAVIOR_V6");
    expect(instructions).toContain("prioridade sobre qualquer trecho da persona publicada que diga que você é Pedro");
    expect(instructions).toContain("você é o assistente do Pedro Sifuentes e também é corretor");
    expect(instructions).toContain("kkkkkk eu sou o assistente do Pedro, também sou corretor");
    expect(instructions).toContain("copie starts_at literalmente sem converter");
    expect(instructions).toContain("Nunca diga que separou ou solicitou um horário sem preencher call_request");
    expect(instructions).toContain("Não afirme que é o próprio Pedro e não negue ser IA");
    expect(instructions).toContain("depois dessa resposta, o lead insistir na mesma pergunta");
    expect(instructions).not.toContain("ou pergunta direta sobre identidade da IA");
  });
});
