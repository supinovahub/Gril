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
    email: z.string().trim().toLowerCase().email(),
    role: z.enum(["manager", "broker"]),
    operationId: z.string().uuid().optional().or(z.literal("")),
  })
  .refine(
    (data) => data.role === "manager" || Boolean(data.operationId),
    { path: ["operationId"], message: "Escolha ao menos a operação do corretor." },
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
    email: formData.get("email"),
    role: formData.get("role"),
    operationId: formData.get("operationId") || "",
  });

  if (!parsed.success) {
    return { status: "error", fields: parsed.error.flatten().fieldErrors };
  }

  const viewer = await requireActiveViewer();
  if (!canManageTeam(viewer)) {
    return { status: "error", message: "Você não pode criar convites." };
  }

  const data = parsed.data;
  const role = data.role;

  if (role === "manager" && viewer.membership?.role !== "owner") {
    return { status: "error", message: "Somente o dono pode convidar gestores." };
  }

  const operationId = data.operationId || null;
  if (operationId && !viewer.operations.some((item) => item.id === operationId)) {
    return { status: "error", message: "A operação selecionada não está disponível." };
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = await createClient();

  const { data: invitation, error } = await supabase
    .from("invitation_links")
    .insert({
      org_id: viewer.organization!.id,
      operation_id: role === "broker" ? operationId : null,
      kind: "individual",
      email: data.email,
      role,
      token_hash: tokenHash,
      expires_at: expiresAt,
      max_uses: 1,
      created_by: viewer.userId,
    })
    .select("id")
    .single();

  if (error || !invitation) {
    return { status: "error", message: "Não foi possível criar o convite." };
  }

  revalidatePath("/app/equipe");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    status: "success",
    message: "Convite individual criado. Ele é vinculado ao e-mail, usado uma vez e expira em 7 dias.",
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

const accessDecisionSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["approve", "reject", "request_correction"]),
  approvedRole: z.enum(["manager", "broker"]).optional(),
  publicReason: z.string().trim().max(1000).optional(),
  confirmation: z.literal("CONFIRMAR AÇÃO"),
});

export async function decideTeamAccessRequestAction(formData: FormData) {
  const parsed = accessDecisionSchema.safeParse({
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
    approvedRole: formData.get("approvedRole") || undefined,
    publicReason: formData.get("publicReason") || undefined,
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) redirect("/app/equipe?erro=confirmacao-invalida");
  const viewer = await requireActiveViewer();
  if (!canManageTeam(viewer)) redirect("/app");
  const operationIds = formData.getAll("operationId").map(String).filter((id) => z.string().uuid().safeParse(id).success);
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_access_request", {
    p_request_id: parsed.data.requestId,
    p_decision: parsed.data.decision,
    p_approved_role: parsed.data.approvedRole,
    p_operation_ids: operationIds,
    p_public_reason: parsed.data.publicReason,
    p_confirmation: parsed.data.confirmation,
  });
  if (error) redirect("/app/equipe?erro=decisao-nao-aplicada");
  revalidatePath("/app/equipe");
  redirect("/app/equipe?sucesso=solicitacao-atualizada");
}

export async function rotateOrganizationCodeAction(formData: FormData) {
  const parsed = z.object({
    action: z.enum(["rotate", "disable"]),
    reason: z.string().trim().min(3).max(500),
    confirmation: z.literal("CONFIRMAR AÇÃO"),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/app/equipe?erro=confirmacao-invalida");
  const viewer = await requireActiveViewer();
  if (viewer.membership?.role !== "owner") redirect("/app/equipe?erro=apenas-o-dono");
  const supabase = await createClient();
  const { error } = await supabase.rpc("rotate_organization_join_code", {
    p_action: parsed.data.action,
    p_reason: parsed.data.reason,
    p_confirmation: parsed.data.confirmation,
  });
  if (error) redirect("/app/equipe?erro=codigo-nao-atualizado");
  revalidatePath("/app/equipe");
  redirect("/app/equipe?sucesso=codigo-atualizado");
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
