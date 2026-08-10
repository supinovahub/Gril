import { describe, expect, it } from "vitest";

import { sortInboxConversations } from "./sorting";

describe("sortInboxConversations", () => {
  it("keeps unread and pending AI conversations above newer regular conversations", () => {
    const conversations = [
      { id: "old-unread", updated_at: "2026-08-01T10:00:00.000Z" },
      { id: "new-read", updated_at: "2026-08-10T10:00:00.000Z" },
      { id: "pending-ai", updated_at: "2026-08-02T10:00:00.000Z" },
    ];
    const attention = new Map([
      ["old-unread", { totalCount: 1 }],
      ["pending-ai", { totalCount: 1 }],
    ]);

    expect(sortInboxConversations(conversations, attention).map(({ id }) => id)).toEqual([
      "pending-ai",
      "old-unread",
      "new-read",
    ]);
  });

  it("uses the latest activity and then the id as deterministic tie breakers", () => {
    const conversations = [
      { id: "b", updated_at: "2026-08-10T10:00:00.000Z" },
      { id: "a", updated_at: "2026-08-10T10:00:00.000Z" },
      { id: "older", updated_at: "2026-08-09T10:00:00.000Z" },
    ];

    expect(sortInboxConversations(conversations, new Map()).map(({ id }) => id)).toEqual([
      "a",
      "b",
      "older",
    ]);
    expect(conversations.map(({ id }) => id)).toEqual(["b", "a", "older"]);
  });
});
