import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { Tables } from "@/lib/database.types";
import { measureServerTask } from "@/lib/observability/server-performance";
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

type ViewerContextPayload = {
  access_block: { message: string | null; type: string } | null;
  membership: Tables<"memberships"> | null;
  operations: Tables<"operations">[];
  organization: Tables<"organizations"> | null;
  permissions: string[];
  platform_role: string | null;
  profile: Tables<"profiles"> | null;
};

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return null;
  }

  let contextResult = await measureServerTask(
    "auth.viewer_context",
    () => supabase.rpc("current_viewer_context_v3"),
  );
  if (contextResult.error) {
    console.warn("Falling back to viewer context v2", contextResult.error.code);
    contextResult = await measureServerTask(
      "auth.viewer_context_v2_fallback",
      () => supabase.rpc("current_viewer_context_v2"),
    );
  }
  const context = !contextResult.error && contextResult.data && !Array.isArray(contextResult.data)
    ? contextResult.data as unknown as ViewerContextPayload
    : null;

  let profile = context?.profile ?? null;
  let membership = context?.membership ?? null;
  let organization = context?.organization ?? null;
  let operations = context?.operations ?? [];
  let permissions = context?.permissions ?? [];
  let platformRole: "platform_admin" | "support" | null = context?.platform_role === "platform_admin" || context?.platform_role === "support"
    ? context.platform_role
    : null;
  let accessBlock = context?.access_block ?? null;
  let supportAccess: "read_only" | "full" | null = null;

  if (!context) {
    console.warn("Falling back to legacy viewer context queries", contextResult.error?.code);
    const [{ data: legacyProfile }, { data: memberships }, { data: platformContext }, { data: accessBlocks }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("memberships").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
      supabase.rpc("current_platform_context"),
      supabase.rpc("current_access_block"),
    ]);
    profile = legacyProfile;
    membership = memberships?.find((item) => item.status === "active")
      ?? memberships?.find((item) => item.status === "pending")
      ?? memberships?.[0]
      ?? null;
    platformRole = platformContext?.[0]?.role === "platform_admin" || platformContext?.[0]?.role === "support"
      ? platformContext[0].role
      : null;
    accessBlock = accessBlocks?.[0]
      ? { type: accessBlocks[0].block_type, message: accessBlocks[0].public_message }
      : null;

    if (membership?.status === "active") {
      const [organizationResult, operationsResult, permissionsResult] = await Promise.all([
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
      permissions = permissionsResult.data?.map((item) => item.permission) ?? [];
    }
  }

  if (membership?.status !== "active" && platformRole) {
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
  if (
    ["manager", "broker"].includes(viewer.membership.role)
    && !viewer.profile?.whatsapp_e164
  ) {
    redirect("/whatsapp-obrigatorio");
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

export function canManageCrm(viewer: Viewer) {
  return viewer.membership?.role === "owner" ||
    viewer.permissions.includes("contacts.manage") ||
    viewer.permissions.includes("pipeline.manage");
}

export const roleLabels: Record<string, string> = {
  owner: "Dono",
  manager: "Gestor",
  broker: "Corretor",
};
