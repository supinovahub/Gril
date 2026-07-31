import "server-only";

import { cache } from "react";
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
};

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return null;
  }

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("memberships")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
  ]);

  const membership =
    memberships?.find((item) => item.status === "active") ??
    memberships?.find((item) => item.status === "pending") ??
    memberships?.[0] ??
    null;

  let organization: Tables<"organizations"> | null = null;
  let operations: Tables<"operations">[] = [];
  let permissions: string[] = [];

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
