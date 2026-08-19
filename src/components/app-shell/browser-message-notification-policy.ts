export const NAVIGATION_COUNTS_REFRESH_EVENT = "gril:navigation-counts-refresh";
export const MESSAGE_SOUND_SETTING_EVENT = "gril:message-sound-setting-change";
export const MESSAGE_SOUND_STORAGE_KEY = "gril:message-sound-enabled:v1";
export const MESSAGE_NOTIFICATION_CLAIMS_STORAGE_KEY = "gril:message-notification-claims:v1";

const TITLE_COUNT_PREFIX = /^\((?:\d+|99\+)\)\s*/;
const CLAIM_TTL_MS = 60_000;
const MAX_STORED_CLAIMS = 50;

type StorageAccess = Pick<Storage, "getItem" | "setItem">;

type NotificationClaims = Record<string, number>;

export type InboundMessageRecord = {
  conversationId: string;
  id: string;
};

export function stripBrowserTabCount(title: string) {
  return title.replace(TITLE_COUNT_PREFIX, "");
}

export function formatBrowserTabTitle(title: string, count: number) {
  const baseTitle = stripBrowserTabCount(title);
  if (count <= 0) return baseTitle;

  const visibleCount = count > 99 ? "99+" : String(count);
  return `(${visibleCount}) ${baseTitle}`;
}

export function parseInboundMessageRecord(value: unknown): InboundMessageRecord | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  if (
    record.direction !== "inbound"
    || typeof record.id !== "string"
    || typeof record.conversation_id !== "string"
  ) {
    return null;
  }

  return {
    conversationId: record.conversation_id,
    id: record.id,
  };
}

export function isMessageSoundEnabled(storage: StorageAccess) {
  try {
    return storage.getItem(MESSAGE_SOUND_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setMessageSoundEnabled(storage: StorageAccess, enabled: boolean) {
  try {
    storage.setItem(MESSAGE_SOUND_STORAGE_KEY, String(enabled));
  } catch {
    // The setting remains enabled for this session when browser storage is unavailable.
  }
}

export function claimMessageNotification(
  storage: StorageAccess,
  messageId: string,
  now = Date.now(),
) {
  let storedClaims: NotificationClaims = {};

  try {
    const storedValue = storage.getItem(MESSAGE_NOTIFICATION_CLAIMS_STORAGE_KEY);
    const parsedValue = storedValue ? JSON.parse(storedValue) : {};
    if (parsedValue && typeof parsedValue === "object" && !Array.isArray(parsedValue)) {
      storedClaims = parsedValue as NotificationClaims;
    }
  } catch {
    storedClaims = {};
  }

  const validClaims = Object.entries(storedClaims)
    .filter(([, claimedAt]) => typeof claimedAt === "number" && now - claimedAt < CLAIM_TTL_MS)
    .sort(([, left], [, right]) => right - left)
    .slice(0, MAX_STORED_CLAIMS);

  if (validClaims.some(([claimedMessageId]) => claimedMessageId === messageId)) return false;

  const nextClaims = Object.fromEntries([[messageId, now], ...validClaims].slice(0, MAX_STORED_CLAIMS));
  try {
    storage.setItem(MESSAGE_NOTIFICATION_CLAIMS_STORAGE_KEY, JSON.stringify(nextClaims));
  } catch {
    // Sound can still play when browser storage is unavailable; only cross-tab deduplication is lost.
  }
  return true;
}
