import { describe, expect, it } from "vitest";

import { campaignCsvRow, decodeCsvBytes, parseCsvLine, resolveCampaignCsvColumns } from "./csv";

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

  it("preserva acentos em CSV UTF-8", () => {
    const bytes = new TextEncoder().encode("Nome;Telefone\nVitória;11999991234");
    expect(decodeCsvBytes(bytes)).toContain("Vitória");
  });

  it("decodifica CSV legado Windows-1252 quando não é UTF-8", () => {
    const bytes = Uint8Array.from([
      0x4e, 0x6f, 0x6d, 0x65, 0x3b, 0x54, 0x65, 0x6c, 0x65, 0x66, 0x6f, 0x6e, 0x65, 0x0a,
      0x45, 0x64, 0x75, 0x61, 0x72, 0x64, 0x6f, 0x20, 0x47, 0x6f, 0x6e, 0xe7, 0x61, 0x6c,
      0x76, 0x65, 0x73, 0x3b, 0x31, 0x31, 0x39, 0x39, 0x39, 0x39, 0x39, 0x31, 0x32, 0x33, 0x34,
    ]);
    expect(decodeCsvBytes(bytes)).toContain("Eduardo Gonçalves");
  });
});
