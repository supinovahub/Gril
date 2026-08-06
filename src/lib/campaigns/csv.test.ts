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
    const header = ["Nome", "Telefone principal", "Principal objetivo", "STUDIOS | qual_valor_de_entrada_é_seu_limite?"];
    const row = campaignCsvRow(parseCsvLine('Maria;"(11) 99999-1234";rentabilizar_com_aluguel_;100k'), header, 0, 1);
    expect(row).toEqual({
      name: "Maria",
      phone: "+5511999991234",
      fields: {
        nome: "Maria",
        telefone_principal: "(11) 99999-1234",
        principal_objetivo: "rentabilizar_com_aluguel_",
        limite_entrada: "100k",
      },
    });
  });

  it("preserva os campos da planilha com chaves estáveis para personalização", () => {
    const header = [
      "Nome", "Telefone principal", "STUDIOS | você_já_investiu_em_studios?",
      "STUDIOS | qual_é_o_seu_principal_objetivo?", "STUDIOS | qual_valor_de_parcela_é_o_seu_limite?",
    ];
    const row = campaignCsvRow(
      ["Maria", "11999991234", "sim", "utilização_própria_", "até_2k"],
      header,
      0,
      1,
    );
    expect(row.fields).toMatchObject({
      ja_investiu_em_studio: "sim",
      objetivo_studio: "utilização_própria_",
      limite_parcela: "até_2k",
    });
  });

  it("lê CSV em UTF-8 e recorre a Windows-1252 quando necessário", () => {
    expect(decodeCsvBytes(new TextEncoder().encode("Nome\nJoão"))).toBe("Nome\nJoão");
    expect(decodeCsvBytes(Uint8Array.from([0x4e, 0x6f, 0x6d, 0x65, 0x0a, 0x4a, 0x6f, 0xe3, 0x6f]))).toBe("Nome\nJoão");
  });
});
