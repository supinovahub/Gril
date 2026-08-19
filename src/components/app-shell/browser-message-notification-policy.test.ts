import { describe, expect, it } from "vitest";

import {
  claimMessageNotification,
  formatBrowserTabTitle,
  isMessageSoundEnabled,
  MESSAGE_NOTIFICATION_CLAIMS_STORAGE_KEY,
  MESSAGE_SOUND_STORAGE_KEY,
  parseInboundMessageRecord,
  setMessageSoundEnabled,
  stripBrowserTabCount,
} from "./browser-message-notification-policy";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("browser message notification policy", () => {
  it("adds the canonical Inbox count to the current tab title", () => {
    expect(formatBrowserTabTitle("Conversas | Pedro", 3)).toBe("(3) Conversas | Pedro");
    expect(formatBrowserTabTitle("(3) Conversas | Pedro", 0)).toBe("Conversas | Pedro");
    expect(formatBrowserTabTitle("(3) Conversas | Pedro", 120)).toBe("(99+) Conversas | Pedro");
    expect(stripBrowserTabCount("(99+) Conversas | Pedro")).toBe("Conversas | Pedro");
  });

  it("accepts only inbound message inserts with stable identifiers", () => {
    expect(parseInboundMessageRecord({
      conversation_id: "conversation-id",
      direction: "inbound",
      id: "message-id",
    })).toEqual({ conversationId: "conversation-id", id: "message-id" });
    expect(parseInboundMessageRecord({
      conversation_id: "conversation-id",
      direction: "outbound",
      id: "message-id",
    })).toBeNull();
    expect(parseInboundMessageRecord({ direction: "inbound", id: "message-id" })).toBeNull();
  });

  it("enables sound by default and persists the local mute setting", () => {
    const storage = new MemoryStorage();

    expect(isMessageSoundEnabled(storage)).toBe(true);
    setMessageSoundEnabled(storage, false);
    expect(storage.getItem(MESSAGE_SOUND_STORAGE_KEY)).toBe("false");
    expect(isMessageSoundEnabled(storage)).toBe(false);
  });

  it("claims one sound per message across tabs during the deduplication window", () => {
    const storage = new MemoryStorage();

    expect(claimMessageNotification(storage, "message-id", 1_000)).toBe(true);
    expect(claimMessageNotification(storage, "message-id", 2_000)).toBe(false);
    expect(claimMessageNotification(storage, "message-id", 62_000)).toBe(true);
  });

  it("bounds stored notification claims", () => {
    const storage = new MemoryStorage();

    for (let index = 0; index < 70; index += 1) {
      claimMessageNotification(storage, `message-${index}`, 1_000 + index);
    }

    const storedClaims = JSON.parse(storage.getItem(MESSAGE_NOTIFICATION_CLAIMS_STORAGE_KEY) ?? "{}") as object;
    expect(Object.keys(storedClaims)).toHaveLength(50);
  });
});
