import { describe, expect, it } from "vitest";

import { PEDRO_CALL_LEAD_TIME_MINUTES } from "./lead-time";

describe("Pedro call lead time", () => {
  it("keeps the approved minimum at one hour", () => {
    expect(PEDRO_CALL_LEAD_TIME_MINUTES).toBe(60);
  });
});

