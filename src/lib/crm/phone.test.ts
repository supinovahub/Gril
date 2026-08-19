import { describe, expect, it } from "vitest";

import { normalizePhoneToE164 } from "./phone";

describe("normalizePhoneToE164", () => {
  it("aplica +55 quando o telefone brasileiro contém DDD", () => {
    expect(normalizePhoneToE164("(11) 99999-1234")).toBe("+5511999991234");
  });

  it("preserva um número internacional explícito", () => {
    expect(normalizePhoneToE164("+1 (415) 555-2671")).toBe("+14155552671");
  });

  it("recompõe o nono dígito de celular brasileiro recebido no formato legado", () => {
    expect(normalizePhoneToE164("+55 (11) 8765-4321")).toBe("+5511987654321");
    expect(normalizePhoneToE164("62 7654-3210")).toBe("+5562976543210");
  });

  it("não altera telefone fixo brasileiro com oito dígitos", () => {
    expect(normalizePhoneToE164("+55 (11) 3333-4444")).toBe("+551133334444");
  });

  it("não inventa DDD", () => {
    expect(normalizePhoneToE164("99999-1234")).toBeNull();
  });

  it("rejeita números fora do limite E.164", () => {
    expect(normalizePhoneToE164("+1234567890123456")).toBeNull();
  });
});

