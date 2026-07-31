import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { regressionPassed } from "./regression";

describe("regressionPassed", () => {
  it("exige ação permitida e nenhuma proibição acionada", () => {
    expect(regressionPassed(["opt_out"], ["send_followup"], "opt_out", [])).toBe(true);
    expect(regressionPassed(["opt_out"], ["send_followup"], "followup", [])).toBe(false);
    expect(regressionPassed(["escalate"], ["invent_fact"], "escalate", ["invent_fact"])).toBe(false);
  });
});
