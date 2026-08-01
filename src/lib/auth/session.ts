import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { Tables } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type Viewer = {
  userId: string;
  email: string;
  profile: Tables<"profiles"> | null;
  membership: Tables<"memberships"> | null;
  organization: Tables<"organizations"> | null;
  operations: Tables<"operations">[];
  permissions: string[];
  platformRole: "platform_admin" | "support" | null;
  supportAccess: "read_only" | "full" | null;
  accessBlock: { type: string; message: string | null } | null;
};

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return null;
  }

  const [{ data: profile }, { data: memberships }, { data: platformContext }, { data: accessBlocks }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("memberships")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase.rpc("current_platform_context"),
    supabase.rpc("current_access_block"),
  ]);

  const platformRole = (platformContext?.[0]?.role === "platform_admin" || platformContext?.[0]?.role === "support")
    ? platformContext[0].role
    : null;
  const accessBlock = accessBlocks?.[0]
    ? { type: accessBlocks[0].block_type, message: accessBlocks[0].public_message }
    : null;

  const membership =
    memberships?.find((item) => item.status === "active") ??
    memberships?.find((item) => item.status === "pending") ??
    memberships?.[0] ??
    null;

  let organization: Tables<"organizations"> | null = null;
  let operations: Tables<"operations">[] = [];
  let permissions: string[] = [];
  let supportAccess: "read_only" | "full" | null = null;

  if (membership?.status === "active") {
    const [organizationResult, operationsResult, permissionsResult] =
      await Promise.all([
        supabase
          .from("organizations")
          .select("*")
          .eq("id", membership.org_id)
          .maybeSingle(),
        supabase
          .from("operations")
          .select("*")
          .eq("org_id", membership.org_id)
          .neq("status", "archived")
          .order("is_default", { ascending: false })
          .order("name"),
        supabase
          .from("membership_permissions")
          .select("permission")
          .eq("membership_id", membership.id),
      ]);

    organization = organizationResult.data;
    operations = operationsResult.data ?? [];
    permissions =
      permissionsResult.data?.map((item) => item.permission) ?? [];
  } else if (platformRole) {
    const cookieStore = await cookies();
    const supportOrgId = cookieStore.get("gril_support_org")?.value;
    if (supportOrgId) {
      const { data: supportContext } = await supabase.rpc("support_access_context", {
        p_org_id: supportOrgId,
      });
      const context = supportContext?.[0];
      if (context?.access_level === "read_only" || context?.access_level === "full") {
        supportAccess = context.access_level;
        const [organizationResult, operationsResult] = await Promise.all([
          supabase.from("organizations").select("*").eq("id", context.org_id).maybeSingle(),
          supabase.from("operations").select("*").eq("org_id", context.org_id).neq("status", "archived").order("is_default", { ascending: false }).order("name"),
        ]);
        organization = organizationResult.data;
        operations = operationsResult.data ?? [];
        permissions = supportAccess === "full"
          ? ["operations.manage", "operations.pause", "contacts.manage", "campaigns.manage", "pipeline.manage", "reports.view", "ai.manage", "privacy.manage", "exports.create", "checklists.manage"]
          : [];
      }
    }
  }

  return {
    userId,
    email:
      typeof claimsData.claims.email === "string" ? claimsData.claims.email : "",
    profile,
    membership,
    organization,
    operations,
    permissions,
    platformRole,
    supportAccess,
    accessBlock,
  };
});

export async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) {
    redirect("/login");
  }
  return viewer;
}

export async function requireActiveViewer() {
  const viewer = await requireViewer();
  if (viewer.accessBlock && !viewer.supportAccess) {
    redirect("/acesso-suspenso");
  }
  if (viewer.platformRole && !viewer.supportAccess) {
    redirect("/platform");
  }
  if (viewer.supportAccess && viewer.organization) {
    return viewer;
  }
  if (!viewer.membership) {
    redirect("/onboarding");
  }
  if (viewer.membership?.status !== "active" || !viewer.organization) {
    redirect("/aguardando-aprovacao");
  }
  return viewer;
}

export function canManageTeam(viewer: Viewer) {
  return (
    viewer.membership?.role === "owner" ||
    (viewer.membership?.role === "manager" &&
      viewer.permissions.includes("team.manage"))
  );
}

export const roleLabels: Record<string, string> = {
  owner: "Dono",
  manager: "Gestor",
  broker: "Corretor",
};
