import { describe, expect, it } from "vitest";

import { normalizePhoneToE164 } from "./phone";

describe("normalizePhoneToE164", () => {
  it("aplica +55 quando o telefone brasileiro contém DDD", () => {
    expect(normalizePhoneToE164("(11) 99999-1234")).toBe("+5511999991234");
  });

  it("preserva um número internacional explícito", () => {
    expect(normalizePhoneToE164("+1 (415) 555-2671")).toBe("+14155552671");
  });

  it("não inventa DDD", () => {
    expect(normalizePhoneToE164("99999-1234")).toBeNull();
  });

  it("rejeita números fora do limite E.164", () => {
    expect(normalizePhoneToE164("+1234567890123456")).toBeNull();
  });
});

