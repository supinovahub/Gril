import { describe, expect, it } from "vitest";

import { compilePedroInstructions, PEDRO_BEHAVIOR_V3_MARKER } from "./pedro-instructions";

describe("compilePedroInstructions", () => {
  it("carrega os invariantes comportamentais e o pacote publicado", () => {
    const instructions = compilePedroInstructions("Persona publicada", { opt_out: "immediate" }, { company: "Studio" });
    expect(instructions).toContain(PEDRO_BEHAVIOR_V3_MARKER);
    expect(instructions).toContain("Persona publicada");
    expect(instructions).toContain("no máximo dois empreendimentos");
    expect(instructions).toContain("nunca que está confirmado");
    expect(instructions).toContain("Não repita campos já preenchidos");
  });
});
