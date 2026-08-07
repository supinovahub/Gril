import { describe, expect, it } from "vitest";

import { belongsToCampaignView } from "./view";

describe("separação das campanhas arquivadas", () => {
  it("não exibe uma campanha arquivada na aba ativa", () => {
    expect(belongsToCampaignView({ status: "archived", archived_at: "2026-08-07T12:00:00Z" }, false)).toBe(false);
    expect(belongsToCampaignView({ status: "completed", archived_at: "2026-08-07T12:00:00Z" }, false)).toBe(false);
  });

  it("exibe campanhas arquivadas somente na aba arquivadas", () => {
    const archived = { status: "archived", archived_at: "2026-08-07T12:00:00Z" };
    expect(belongsToCampaignView(archived, true)).toBe(true);
    expect(belongsToCampaignView({ status: "running", archived_at: null }, true)).toBe(false);
  });

  it("protege a aba ativa contra status arquivado sem timestamp", () => {
    expect(belongsToCampaignView({ status: "archived", archived_at: null }, false)).toBe(false);
  });
});
