import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function loadInternalWorkspace(input: {
  orgId: string;
  operationId?: string;
  assistantRole: "pedro" | "lionel";
  requestedThreadId?: string;
  threadType?: "broker_assistant";
}) {
  const supabase = await createClient();
  if (input.operationId && !input.threadType) {
    await supabase.rpc("ensure_internal_general_thread", {
      p_assistant_role: input.assistantRole,
      p_operation_id: input.operationId,
    });
  }
  let query = supabase.from("internal_threads")
    .select("*")
    .eq("org_id", input.orgId)
    .eq("assistant_role", input.assistantRole)
    .neq("status", "archived")
    .order("requires_action", { ascending: false })
    .order("updated_at", { ascending: false });
  if (input.operationId) query = query.eq("operation_id", input.operationId);
  if (input.threadType) query = query.eq("thread_type", input.threadType);
  const { data: threads, error } = await query.limit(100);
  if (error) throw error;
  const activeThread = threads?.find((thread) => thread.id === input.requestedThreadId) ?? threads?.[0] ?? null;
  const { data: messages, error: messagesError } = activeThread
    ? await supabase.from("internal_messages").select("*").eq("thread_id", activeThread.id).order("created_at").limit(300)
    : { data: [], error: null };
  if (messagesError) throw messagesError;
  if (activeThread) await supabase.rpc("mark_internal_thread_read", { p_thread_id: activeThread.id });
  return { threads: threads ?? [], activeThread, messages: messages ?? [] };
}
