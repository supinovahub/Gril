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
  });
});
