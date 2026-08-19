export type InboxConversationActivity = {
  id: string;
  /**
   * Legacy RPC key containing the latest message `created_at` (or the
   * conversation start when it has no messages), not conversation metadata.
   */
  updated_at: string;
};

function activityTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

/**
 * Mirrors WhatsApp's conversation list: the latest message comes first.
 */
export function sortInboxConversations<T extends InboxConversationActivity>(
  conversations: readonly T[],
) {
  return [...conversations].sort((left, right) => {
    const activityDifference = activityTimestamp(right.updated_at)
      - activityTimestamp(left.updated_at);
    if (activityDifference !== 0) return activityDifference;

    return left.id.localeCompare(right.id);
  });
}
