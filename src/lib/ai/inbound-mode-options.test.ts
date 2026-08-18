import { describe, expect, it } from "vitest";

import { getInboundModeOptions } from "./inbound-mode-options";

describe("getInboundModeOptions", () => {
  it("keeps production hidden without an active allowlisted number", () => {
    expect(getInboundModeOptions(false)).toEqual(["off", "shadow", "assisted"]);
  });

  it("shows production without selecting it when an allowlisted number exists", () => {
    expect(getInboundModeOptions(true)).toEqual(["off", "shadow", "assisted", "production"]);
  });
});
