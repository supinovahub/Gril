import { describe, expect, it } from "vitest";

import { zonedLocalDateTimeToIso } from "./zoned-local";

describe("zonedLocalDateTimeToIso", () => {
  it("converts Sao Paulo local time without a fixed offset", () => {
    expect(zonedLocalDateTimeToIso("2026-08-10T09:30", "America/Sao_Paulo")).toBe("2026-08-10T12:30:00.000Z");
  });

  it("respects a different operation timezone", () => {
    expect(zonedLocalDateTimeToIso("2026-08-10T09:30", "America/Manaus")).toBe("2026-08-10T13:30:00.000Z");
  });

  it("rejects malformed values", () => {
    expect(() => zonedLocalDateTimeToIso("10/08/2026 09:30", "America/Sao_Paulo")).toThrow("invalid_local_datetime");
  });
});
