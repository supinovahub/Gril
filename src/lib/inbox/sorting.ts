export type InboxConversationActivity = {
  id: string;
  updated_at: string;
};

export type InboxAttentionCount = {
  totalCount?: number | null;
};

function hasAttention(
  conversationId: string,
  attentionByConversation: ReadonlyMap<string, InboxAttentionCount>,
) {
  return (attentionByConversation.get(conversationId)?.totalCount ?? 0) > 0;
}

function activityTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

/**
 * Keeps conversations needing action above the regular inbox, then uses the
 * latest conversation activity as the ordering within each group.
 */
export function sortInboxConversations<T extends InboxConversationActivity>(
  conversations: readonly T[],
  attentionByConversation: ReadonlyMap<string, InboxAttentionCount>,
) {
  return [...conversations].sort((left, right) => {
    const attentionDifference = Number(hasAttention(right.id, attentionByConversation))
      - Number(hasAttention(left.id, attentionByConversation));
    if (attentionDifference !== 0) return attentionDifference;

    const activityDifference = activityTimestamp(right.updated_at)
      - activityTimestamp(left.updated_at);
    if (activityDifference !== 0) return activityDifference;

    return left.id.localeCompare(right.id);
  });
}
