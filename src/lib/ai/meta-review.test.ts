import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { sanitizeMetaReviewSignals } from "./meta-review";

describe("sanitizeMetaReviewSignals", () => {
  it("masks personal identifiers before model review", () => {
    const sanitized = JSON.stringify(sanitizeMetaReviewSignals([{
      observed: "Meu e-mail é lead@example.com, CPF 123.456.789-10 e telefone +55 11 99999-9999.",
      nested: { link: "https://crm.example.com/private/123" },
    }]));

    expect(sanitized).toContain("[EMAIL]");
    expect(sanitized).toContain("[DOCUMENTO]");
    expect(sanitized).toContain("[TELEFONE]");
    expect(sanitized).toContain("[LINK]");
    expect(sanitized).not.toContain("lead@example.com");
    expect(sanitized).not.toContain("123.456.789-10");
  });

  it("bounds deeply nested evidence", () => {
    const sanitized = sanitizeMetaReviewSignals({
      a: { b: { c: { d: { e: { f: { g: { secret: "hidden" } } } } } } },
    });

    expect(JSON.stringify(sanitized)).toContain("[CONTEXTO_OMITIDO]");
  });
});
