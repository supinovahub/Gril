import { describe, expect, it } from "vitest";

import { campaignCsvRow, parseCsvLine, resolveCampaignCsvColumns } from "./csv";

describe("importação CSV de campanhas", () => {
  it("reconhece Nome e Telefone principal ignorando caixa e espaços", () => {
    const mapping = resolveCampaignCsvColumns(
      [" Nome ", "Telefone principal"],
      "nome",
      "telefone principal",
    );
    expect(mapping).toEqual({ nameIndex: 0, phoneIndex: 1, valid: true });
  });

  it("detecta automaticamente cabeçalhos equivalentes", () => {
    const mapping = resolveCampaignCsvColumns(["Nome do cliente", "WhatsApp"], "", "");
    expect(mapping).toEqual({ nameIndex: 0, phoneIndex: 1, valid: true });
  });

  it("normaliza telefone brasileiro com máscara antes do envio ao banco", () => {
    const row = campaignCsvRow(parseCsvLine('Maria;"(11) 99999-1234"'), 0, 1);
    expect(row).toEqual({ name: "Maria", phone: "+5511999991234" });
  });
});
