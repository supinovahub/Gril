import { describe, expect, it } from "vitest";

import {
  REALTIME_RECONCILIATION_INTERVAL_MS,
  shouldReconcileReplication,
  shouldReconcileSubscription,
  tablesForPathname,
} from "./realtime-refresh-policy";

describe("realtime refresh policy", () => {
  it("subscribes the Inbox to message activity", () => {
    expect(tablesForPathname("/app/inbox")).toContain("messages");
    expect(tablesForPathname("/app/inbox/conversation-id")).toContain("conversations");
  });

  it("reconciles after the channel and replication stream become ready", () => {
    expect(shouldReconcileSubscription("SUBSCRIBED")).toBe(true);
    expect(shouldReconcileSubscription("CHANNEL_ERROR")).toBe(false);
    expect(shouldReconcileReplication({ extension: "system", status: "ok" })).toBe(true);
    expect(shouldReconcileReplication({ extension: "postgres_changes", status: "ok" })).toBe(false);
    expect(shouldReconcileReplication({ extension: "system", status: "error" })).toBe(false);
  });

  it("keeps a bounded fallback reconciliation cadence", () => {
    expect(REALTIME_RECONCILIATION_INTERVAL_MS).toBe(30_000);
  });
});
