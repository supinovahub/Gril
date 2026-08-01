"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { canManageTeam, requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { permissionOptions } from "./constants";

const zeroUuid = "00000000-0000-0000-0000-000000000000";

export type InviteState = {
  status: "idle" | "error" | "success";
  message?: string;
  inviteUrl?: string;
  fields?: Record<string, string[]>;
};

const inviteSchema = z
  .object({
    kind: z.enum(["general", "individual"]),
    email: z.string().trim().toLowerCase().optional(),
    role: z.enum(["manager", "broker"]),
    operationId: z.string().uuid().optional().or(z.literal("")),
    expiresDays: z.union([z.coerce.number().int().min(1).max(30), z.literal("never")]),
    maxUses: z.coerce.number().int().min(1).max(1000),
  })
  .refine(
    (data) => data.kind === "general" || z.string().email().safeParse(data.email).success,
    { path: ["email"], message: "Informe o e-mail do convite individual." },
  );

const changeSchema = z.object({
  membershipId: z.string().uuid(),
  requestedAction: z.enum(["approve", "suspend", "reactivate", "revoke"]),
  requestedRole: z.enum(["manager", "broker"]).optional(),
});

export async function createInvitationAction(
  _previous: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const parsed = inviteSchema.safeParse({
    kind: formData.get("kind"),
    email: formData.get("email") || undefined,
    role: formData.get("role"),
    operationId: formData.get("operationId") || "",
    expiresDays: formData.get("expiresDays"),
    maxUses: formData.get("maxUses"),
  });

  if (!parsed.success) {
    return { status: "error", fields: parsed.error.flatten().fieldErrors };
  }

  const viewer = await requireActiveViewer();
  if (!canManageTeam(viewer)) {
    return { status: "error", message: "Você não pode criar convites." };
  }

  const data = parsed.data;
  const role = data.kind === "general" ? "broker" : data.role;

  if (role === "manager" && viewer.membership?.role !== "owner") {
    return { status: "error", message: "Somente o dono pode convidar gestores." };
  }

  const operationId = data.operationId || null;
  if (operationId && !viewer.operations.some((item) => item.id === operationId)) {
    return { status: "error", message: "A operação selecionada não está disponível." };
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = data.expiresDays === "never"
    ? null
    : new Date(Date.now() + data.expiresDays * 24 * 60 * 60 * 1000).toISOString();
  const supabase = await createClient();

  const { data: invitation, error } = await supabase
    .from("invitation_links")
    .insert({
      org_id: viewer.organization!.id,
      operation_id: data.kind === "individual" ? operationId : null,
      kind: data.kind,
      email: data.kind === "individual" ? data.email : null,
      role,
      token_hash: tokenHash,
      expires_at: expiresAt,
      max_uses: data.kind === "general" ? data.maxUses : 1,
      created_by: viewer.userId,
    })
    .select("id")
    .single();

  if (error || !invitation) {
    return { status: "error", message: "Não foi possível criar o convite." };
  }

  if (data.kind === "general") {
    await supabase
      .from("invitation_links")
      .update({ status: "revoked" })
      .eq("org_id", viewer.organization!.id)
      .eq("kind", "general")
      .eq("status", "active")
      .neq("id", invitation.id);
  }

  revalidatePath("/app/equipe");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    status: "success",
    message:
      data.kind === "general"
        ? "Novo link geral criado; links gerais anteriores foram revogados."
        : "Convite individual criado.",
    inviteUrl: `${baseUrl}/convite/${token}`,
  };
}

export async function changeMembershipAction(formData: FormData) {
  const parsed = changeSchema.safeParse({
    membershipId: formData.get("membershipId"),
    requestedAction: formData.get("requestedAction"),
    requestedRole: formData.get("requestedRole") || undefined,
  });

  if (!parsed.success) return;

  const viewer = await requireActiveViewer();
  if (!canManageTeam(viewer)) return;

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("memberships")
    .select("id, org_id")
    .eq("id", parsed.data.membershipId)
    .eq("org_id", viewer.organization!.id)
    .maybeSingle();

  if (!target) return;

  await supabase.from("membership_change_requests").insert({
    membership_id: target.id,
    org_id: zeroUuid,
    actor_user_id: viewer.userId,
    requested_action: parsed.data.requestedAction,
    requested_role:
      parsed.data.requestedAction === "approve"
        ? parsed.data.requestedRole ?? "broker"
        : null,
  });

  revalidatePath("/app/equipe");
}

export async function updateManagerPermissionsAction(
  membershipId: string,
  formData: FormData,
) {
  if (!z.string().uuid().safeParse(membershipId).success) return;

  const viewer = await requireActiveViewer();
  if (viewer.membership?.role !== "owner") return;

  const requested = formData
    .getAll("permission")
    .map(String)
    .filter((value): value is (typeof permissionOptions)[number] =>
      permissionOptions.includes(value as (typeof permissionOptions)[number]),
    );

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("memberships")
    .select("id")
    .eq("id", membershipId)
    .eq("org_id", viewer.organization!.id)
    .eq("role", "manager")
    .maybeSingle();

  if (!target) return;

  if (requested.length) {
    const { error } = await supabase.from("membership_permissions").upsert(
      requested.map((permission) => ({
        membership_id: membershipId,
        permission,
      })),
    );
    if (error) return;
  }

  const current = new Set(requested);
  const { data: existing } = await supabase
    .from("membership_permissions")
    .select("permission")
    .eq("membership_id", membershipId);

  const toDelete = (existing ?? [])
    .map((item) => item.permission)
    .filter((permission) => !current.has(permission as (typeof permissionOptions)[number]));

  if (toDelete.length) {
    await supabase
      .from("membership_permissions")
      .delete()
      .eq("membership_id", membershipId)
      .in("permission", toDelete);
  }

  revalidatePath("/app/equipe");
}

export async function updateMemberCallSettingsAction(membershipId: string, formData: FormData) {
  if (!z.string().uuid().safeParse(membershipId).success) return;
  const viewer = await requireActiveViewer();
  if (!canManageTeam(viewer)) return;
  const operation = viewer.operations.find((item) => item.id === formData.get("operationId"));
  if (!operation) return;
  const supabase = await createClient();
  const { data: target } = await supabase.from("memberships").select("id")
    .eq("id", membershipId).eq("org_id", viewer.organization!.id).eq("status", "active").maybeSingle();
  if (!target) return;
  await supabase.from("call_settings_requests").insert({
    org_id: viewer.organization!.id, operation_id: operation.id, membership_id: membershipId,
    can_receive_calls: formData.get("canReceiveCalls") === "on",
    is_preferred_receiver: formData.get("preferredReceiver") === "on",
    receive_urgent_call_alerts: formData.get("urgentAlerts") === "on",
    actor_user_id: viewer.userId,
  });
  revalidatePath("/app/equipe"); revalidatePath("/app/agenda");
}

export async function requestOwnershipTransferAction(formData: FormData) {
  const parsed = z.object({ targetMembershipId: z.string().uuid(), password: z.string().min(8).max(1000) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/app/equipe");
  const viewer = await requireActiveViewer(); if (viewer.membership?.role !== "owner") return;
  const supabase = await createClient();
  const { error: reauthError } = await supabase.auth.signInWithPassword({ email: viewer.email, password: parsed.data.password });
  if (reauthError) redirect("/app/equipe");
  const { error } = await supabase.from("ownership_transfer_requests").insert({ org_id: viewer.organization!.id, target_membership_id: parsed.data.targetMembershipId, requested_by: viewer.userId, reauthenticated_at: new Date().toISOString() });
  if (error) redirect("/app/equipe"); revalidatePath("/app/equipe");
}

export async function acceptOwnershipTransferAction(formData: FormData) {
  const transferId = z.string().uuid().safeParse(formData.get("transferId")); if (!transferId.success) return;
  const viewer = await requireActiveViewer(); const supabase = await createClient();
  await supabase.from("ownership_transfer_requests").update({ status: "accepted", accepted_by: viewer.userId }).eq("id", transferId.data).eq("target_membership_id", viewer.membership!.id).eq("status", "pending");
  revalidatePath("/app/equipe"); redirect("/app");
}
