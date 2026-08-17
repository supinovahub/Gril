import "server-only";

import type { Tables } from "@/lib/database.types";
import { measureServerTask } from "@/lib/observability/server-performance";
import { createClient } from "@/lib/supabase/server";

type InternalWorkspacePayload = {
  threads: Tables<"internal_threads">[];
  activeThread: Tables<"internal_threads"> | null;
  messages: Tables<"internal_messages">[];
};

export async function loadInternalWorkspace(input: {
  orgId: string;
  operationId?: string;
  assistantRole: "pedro" | "lionel";
  requestedThreadId?: string;
  threadType?: "broker_assistant";
  search?: string;
  status?: string;
  priority?: string;
  requiresAction?: boolean;
}) {
  const supabase = await createClient();
  const { data, error } = await measureServerTask(
    "internal_chat.workspace",
    () => supabase.rpc("internal_chat_workspace_bootstrap", {
      p_assistant_role: input.assistantRole,
      p_operation_id: input.operationId ?? null,
      p_org_id: input.orgId,
      p_priority: input.priority ?? null,
      p_requested_thread_id: input.requestedThreadId ?? null,
      p_requires_action: input.requiresAction ?? false,
      p_search: input.search ?? null,
      p_status: input.status ?? null,
      p_thread_type: input.threadType ?? null,
    }),
  );
  if (error) throw error;
  const workspace = data as unknown as InternalWorkspacePayload;
  return {
    threads: workspace.threads ?? [],
    activeThread: workspace.activeThread ?? null,
    messages: workspace.messages ?? [],
  };
}
