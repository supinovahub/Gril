"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireViewer } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requirePlatform(role?: "platform_admin") {
  const viewer = await requireViewer();
  if (!viewer.platformRole || (role && viewer.platformRole !== role)) redirect("/app");
  return viewer;
}

function platformRedirect(message: string, kind: "erro" | "sucesso" = "erro"): never {
  redirect(`/platform?${kind}=${encodeURIComponent(message)}`);
}

export async function decidePlatformAccessRequestAction(formData: FormData) {
  const parsed = z.object({
    requestId: z.string().uuid(),
    decision: z.enum(["approve", "reject", "request_correction", "revoke_approval"]),
    publicReason: z.string().trim().max(1000).optional(),
    internalNote: z.string().trim().max(2000).optional(),
    confirmation: z.literal("CONFIRMAR AÇÃO"),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) platformRedirect("Confirmação ou decisão inválida.");
  await requirePlatform("platform_admin");
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_access_request", {
    p_request_id: parsed.data.requestId,
    p_decision: parsed.data.decision,
    p_public_reason: parsed.data.publicReason,
    p_internal_note: parsed.data.internalNote,
    p_confirmation: parsed.data.confirmation,
  });
  if (error) platformRedirect("A decisão não foi aplicada. Verifique o estado atual da solicitação.");
  revalidatePath("/platform");
  platformRedirect("Solicitação atualizada.", "sucesso");
}

export async function addPlatformRequestNoteAction(formData: FormData) {
  const parsed = z.object({ requestId: z.string().uuid(), note: z.string().trim().min(3).max(2000) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) platformRedirect("Nota interna inválida.");
  await requirePlatform();
  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_add_access_request_note", { p_request_id: parsed.data.requestId, p_note: parsed.data.note });
  if (error) platformRedirect("Não foi possível registrar a nota interna.");
  revalidatePath("/platform");
  platformRedirect("Nota interna registrada.", "sucesso");
}

export async function controlOrganizationAction(formData: FormData) {
  const parsed = z.object({
    organizationId: z.string().uuid(), action: z.enum(["suspend", "reactivate", "archive", "restore"]),
    publicMessage: z.string().trim().max(500).optional(), internalNote: z.string().trim().min(3).max(2000),
    confirmation: z.literal("CONFIRMAR AÇÃO"),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) platformRedirect("Revise a confirmação e os motivos da ação.");
  await requirePlatform("platform_admin");
  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_control_organization", {
    p_org_id: parsed.data.organizationId, p_action: parsed.data.action,
    p_public_message: parsed.data.publicMessage ?? "", p_internal_note: parsed.data.internalNote,
    p_confirmation: parsed.data.confirmation,
  });
  if (error) platformRedirect("A organização não está no estado exigido para esta ação.");
  revalidatePath("/platform");
  platformRedirect("Estado da organização atualizado.", "sucesso");
}

export async function controlUserAction(formData: FormData) {
  const parsed = z.object({
    userId: z.string().uuid(), action: z.enum(["suspend", "reactivate", "block_requests", "unblock_requests"]),
    publicMessage: z.string().trim().max(500).optional(), internalNote: z.string().trim().min(3).max(2000),
    confirmation: z.literal("CONFIRMAR AÇÃO"),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) platformRedirect("Revise a confirmação e os motivos da ação.");
  await requirePlatform("platform_admin");
  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_control_user", {
    p_user_id: parsed.data.userId, p_action: parsed.data.action, p_public_message: parsed.data.publicMessage ?? "",
    p_internal_note: parsed.data.internalNote, p_confirmation: parsed.data.confirmation,
  });
  if (error) platformRedirect("A conta não pôde ser atualizada. O último administrador e a própria conta são protegidos.");
  revalidatePath("/platform");
  platformRedirect("Conta atualizada e sessões invalidadas quando aplicável.", "sucesso");
}

export async function manageSupportGrantAction(formData: FormData) {
  const parsed = z.object({
    organizationId: z.string().uuid(), action: z.enum(["grant", "revoke"]),
    accessLevel: z.enum(["read_only", "full"]), contractReference: z.string().trim().max(500).optional(),
    expiresAt: z.string().datetime({ local: true }).optional().or(z.literal("")), confirmation: z.literal("CONFIRMAR AÇÃO"),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) platformRedirect("Revise contrato, nível e confirmação.");
  await requirePlatform("platform_admin");
  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_manage_support_grant", {
    p_org_id: parsed.data.organizationId, p_action: parsed.data.action, p_access_level: parsed.data.accessLevel,
    p_contract_reference: parsed.data.contractReference ?? "",
    p_expires_at: parsed.data.expiresAt ? new Date(parsed.data.expiresAt).toISOString() : (null as unknown as string),
    p_confirmation: parsed.data.confirmation,
  });
  if (error) platformRedirect("A concessão contratual não pôde ser atualizada.");
  revalidatePath("/platform");
  platformRedirect("Acesso externo de suporte atualizado.", "sucesso");
}

export async function invitePlatformAccountAction(formData: FormData) {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(["platform_admin", "support"]), confirmation: z.literal("CONFIRMAR AÇÃO") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) platformRedirect("Revise o e-mail, o papel e a confirmação.");
  const viewer = await requirePlatform("platform_admin");
  const admin = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${appUrl}/auth/callback?next=/redefinir-senha`,
    data: { platform_role: parsed.data.role, invited_by: viewer.userId },
  });
  if (error || !data.user) platformRedirect("Não foi possível enviar o convite. Verifique se o e-mail já possui conta.");
  const { error: registerError } = await admin.rpc("register_platform_invitation", {
    p_user_id: data.user.id, p_email: parsed.data.email, p_role: parsed.data.role, p_created_by: viewer.userId,
    p_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (registerError) platformRedirect("O e-mail foi convidado, mas o papel de plataforma precisa ser revisado no Supabase.");
  revalidatePath("/platform");
  platformRedirect("Convite de plataforma enviado por e-mail.", "sucesso");
}

export async function managePlatformPrincipalAction(formData: FormData) {
  const parsed = z.object({ userId: z.string().uuid(), action: z.enum(["activate", "deactivate", "change_role", "revoke_invitation"]), role: z.enum(["platform_admin", "support"]), confirmation: z.literal("CONFIRMAR AÇÃO") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) platformRedirect("Ação de conta de plataforma inválida.");
  await requirePlatform("platform_admin");
  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_manage_principal", { p_user_id: parsed.data.userId, p_action: parsed.data.action, p_role: parsed.data.role, p_confirmation: parsed.data.confirmation });
  if (error) platformRedirect("A ação foi bloqueada para proteger o último administrador ou a própria conta.");
  revalidatePath("/platform");
  platformRedirect("Conta de plataforma atualizada.", "sucesso");
}

export async function preauthorizeOrganizationAction(formData: FormData) {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email(), action: z.enum(["create", "revoke"]), confirmation: z.literal("CONFIRMAR AÇÃO") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) platformRedirect("Pré-autorização inválida.");
  await requirePlatform("platform_admin");
  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_preauthorize_organization", { p_email: parsed.data.email, p_action: parsed.data.action, p_confirmation: parsed.data.confirmation });
  if (error) platformRedirect("A pré-autorização não pôde ser atualizada.");
  if (parsed.data.action === "revoke") {
    revalidatePath("/platform");
    platformRedirect("Pré-autorização revogada.", "sucesso");
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = `${appUrl}/cadastro?email=${encodeURIComponent(parsed.data.email)}`;
  revalidatePath("/platform");
  redirect(`/platform?sucesso=${encodeURIComponent("Pré-autorização criada por 30 dias.")}&link=${encodeURIComponent(link)}`);
}

export async function enterSupportContextAction(formData: FormData) {
  const orgId = z.string().uuid().safeParse(formData.get("organizationId"));
  if (!orgId.success) platformRedirect("Organização inválida.");
  await requirePlatform();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("support_access_context", { p_org_id: orgId.data });
  if (error || !data?.length) platformRedirect("Não existe concessão contratual ativa para esta organização.");
  const cookieStore = await cookies();
  cookieStore.set("gril_support_org", orgId.data, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
  redirect("/app");
}

export async function clearSupportContextAction() {
  await requirePlatform();
  const cookieStore = await cookies();
  cookieStore.delete("gril_support_org");
  redirect("/platform");
}

export async function registerPlatformPushSubscriptionAction(input: unknown) {
  const parsed = z.object({ endpoint: z.string().url().max(4000), keys: z.object({ p256dh: z.string().min(20).max(1000), auth: z.string().min(10).max(500) }), userAgent: z.string().max(500).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Assinatura push inválida." };
  await requirePlatform();
  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_platform_push_subscription", {
    p_endpoint: parsed.data.endpoint, p_p256dh: parsed.data.keys.p256dh, p_auth_key: parsed.data.keys.auth, p_user_agent: parsed.data.userAgent,
  });
  return error ? { ok: false, message: "Não foi possível registrar este navegador." } : { ok: true, message: "Notificações administrativas ativadas." };
}
