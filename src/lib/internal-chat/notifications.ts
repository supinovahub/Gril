import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

export async function loadInternalChatNotifications(
  supabase: SupabaseClient<Database>,
  orgId: string,
  userId: string,
) {
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
