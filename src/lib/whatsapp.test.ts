import { describe, expect, it } from "vitest";

import { normalizeWhatsApp, requiredWhatsAppSchema } from "./whatsapp";

describe("WhatsApp normalization", () => {
  it("normalizes a Brazilian formatted number to E.164", () => {
    expect(normalizeWhatsApp("+55 (11) 99999-9999")).toBe("+5511999999999");
  });

  it("requires country, area code and number", () => {
    expect(requiredWhatsAppSchema.safeParse("").success).toBe(false);
    expect(requiredWhatsAppSchema.safeParse("+5511999999999").success).toBe(true);
  });
});
