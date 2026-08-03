import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

export type InboxNotificationCount = {
  conversationId: string;
  unreadInboundCount: number;
  pendingSuggestionCount: number;
  totalCount: number;
};

export async function loadInboxNotificationCounts(
  supabase: SupabaseClient<Database>,
  orgId: string,
) {
  const { data, error } = await supabase
    .from("inbox_notification_counts")
    .select("conversation_id,unread_inbound_count,pending_suggestion_count,total_count")
    .eq("org_id", orgId)
    .gt("total_count", 0);

  if (error) {
    console.error("Failed to load Inbox notification counts", error);
    return {
      byConversation: new Map<string, InboxNotificationCount>(),
      conversationsWithNotifications: 0,
    };
  }

  const counts = (data ?? []).flatMap((row) => row.conversation_id ? [{
    conversationId: row.conversation_id,
    unreadInboundCount: row.unread_inbound_count ?? 0,
    pendingSuggestionCount: row.pending_suggestion_count ?? 0,
    totalCount: row.total_count ?? 0,
  }] : []);

  return {
    byConversation: new Map(counts.map((count) => [count.conversationId, count])),
    conversationsWithNotifications: counts.length,
  };
}

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function describeInboxNotifications(count: InboxNotificationCount) {
  const details = [
    count.unreadInboundCount > 0
      ? plural(count.unreadInboundCount, "mensagem nova", "mensagens novas")
      : null,
    count.pendingSuggestionCount > 0
      ? plural(count.pendingSuggestionCount, "sugestão da IA", "sugestões da IA")
      : null,
  ].filter(Boolean);

  return `${plural(count.totalCount, "pendência", "pendências")}: ${details.join(" e ")}`;
}
