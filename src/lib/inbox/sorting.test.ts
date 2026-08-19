import { describe, expect, it } from "vitest";

import { sortInboxConversations } from "./sorting";

describe("sortInboxConversations", () => {
  it("keeps the conversations with the latest messages first regardless of pending attention", () => {
    const conversations = [
      { id: "old-unread", updated_at: "2026-08-01T10:00:00.000Z" },
      { id: "new-read", updated_at: "2026-08-10T10:00:00.000Z" },
      { id: "pending-ai", updated_at: "2026-08-02T10:00:00.000Z" },
    ];

    expect(sortInboxConversations(conversations).map(({ id }) => id)).toEqual([
      "new-read",
      "pending-ai",
      "old-unread",
    ]);
  });

  it("uses the latest message and then the id as deterministic tie breakers", () => {
    const conversations = [
      { id: "b", updated_at: "2026-08-10T10:00:00.000Z" },
      { id: "a", updated_at: "2026-08-10T10:00:00.000Z" },
      { id: "older", updated_at: "2026-08-09T10:00:00.000Z" },
    ];

    expect(sortInboxConversations(conversations).map(({ id }) => id)).toEqual([
      "a",
      "b",
      "older",
    ]);
    expect(conversations.map(({ id }) => id)).toEqual(["b", "a", "older"]);
  });
});
