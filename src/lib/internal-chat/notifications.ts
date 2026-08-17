import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export async function loadInternalChatNotifications(
  supabase: SupabaseClient<Database>,
  orgId: string,
  userId: string,
) {
  const { data: notificationCounts, error: notificationCountsError } = await supabase.rpc(
    "internal_chat_notification_counts",
    { p_org_id: orgId },
  );
  if (!notificationCountsError && notificationCounts?.[0]) {
    return {
      broker: notificationCounts[0].broker ?? 0,
      lionel: notificationCounts[0].lionel ?? 0,
      pedro: notificationCounts[0].pedro ?? 0,
    };
  }

  console.warn("Falling back to legacy internal notification queries", notificationCountsError?.code);
  const [{ data: threads }, { data: reads }] = await Promise.all([
    supabase.from("internal_threads")
      .select("id,assistant_role,thread_type,requires_action,updated_at")
      .eq("org_id", orgId)
      .not("status", "in", "(resolved,archived)"),
    supabase.from("internal_thread_reads").select("thread_id,last_read_at").eq("org_id", orgId).eq("user_id", userId),
  ]);
  const readByThread = new Map((reads ?? []).map((read) => [read.thread_id, read.last_read_at]));
  const counts = { pedro: 0, lionel: 0, broker: 0 };
  for (const thread of threads ?? []) {
    const unread = !readByThread.get(thread.id) || thread.updated_at > readByThread.get(thread.id)!;
    if (!thread.requires_action && !unread) continue;
    if (thread.thread_type === "broker_assistant") counts.broker += 1;
    else if (thread.assistant_role === "lionel") counts.lionel += 1;
    else counts.pedro += 1;
  }
  return counts;
}

export const getInternalChatNotifications = cache(async (orgId: string, userId: string) => {
  const supabase = await createClient();
  return loadInternalChatNotifications(supabase, orgId, userId);
});
