import "server-only";

import { cache } from "react";

import { measureServerTask } from "@/lib/observability/server-performance";
import { createClient } from "@/lib/supabase/server";

export type WorkspaceNavigationCounts = {
  inbox: number;
  pedro: number;
  lionel: number;
  broker: number;
};

const emptyCounts: WorkspaceNavigationCounts = {
  inbox: 0,
  pedro: 0,
  lionel: 0,
  broker: 0,
};

export const getWorkspaceNavigationCounts = cache(async (
  orgId?: string,
): Promise<WorkspaceNavigationCounts> => {
  const supabase = await createClient();
  const { data, error } = await measureServerTask(
    "navigation.counts",
    () => supabase.rpc("workspace_navigation_counts", orgId ? { p_org_id: orgId } : {}),
  );

  if (error || !data || Array.isArray(data) || typeof data !== "object") {
    console.error("Failed to load workspace navigation counts", error);
    return emptyCounts;
  }

  const payload = data as Record<string, unknown>;
  return {
    inbox: typeof payload.inbox === "number" ? payload.inbox : 0,
    pedro: typeof payload.pedro === "number" ? payload.pedro : 0,
    lionel: typeof payload.lionel === "number" ? payload.lionel : 0,
    broker: typeof payload.broker === "number" ? payload.broker : 0,
  };
});
