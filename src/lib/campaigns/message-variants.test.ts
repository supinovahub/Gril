import { describe, expect, it } from "vitest";

import { DEFAULT_CAMPAIGN_VARIANTS, renderCampaignOpening } from "./message-variants";

describe("variações de mensagens de reativação", () => {
  const fields = {
    principal_objetivo: "rentabilizar_com_aluguel_",
    ja_investiu_em_studio: "não",
    limite_entrada: "100k",
    limite_parcela: "até_2k",
  };

  it("gera abordagens diferentes mantendo o mesmo objetivo e os dados do lead", () => {
    const messages = DEFAULT_CAMPAIGN_VARIANTS.map((variant) => renderCampaignOpening(variant.template, "Maria", fields));
    expect(new Set(messages).size).toBe(3);
    expect(messages.every((message) => message.includes("Maria") && message.includes("rentabilizar com aluguel") && message.includes("100k") && message.includes("até 2k"))).toBe(true);
  });

  it("não deixa placeholders ou valores indefinidos quando a planilha está incompleta", () => {
    const message = renderCampaignOpening(DEFAULT_CAMPAIGN_VARIANTS[0].template, "Maria", {});
    expect(message).not.toMatch(/{{|undefined|null/);
    expect(message).toContain("as condições que você tinha em mente");
  });
});
