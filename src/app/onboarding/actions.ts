"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireViewer } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const timezoneSchema = z.enum(["America/Sao_Paulo", "America/Manaus", "America/Cuiaba", "America/Rio_Branco"]);
const phoneSchema = z.string().trim().regex(/^\+[1-9][0-9]{7,14}$/);
const joinCodeSchema = z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{8}$/);

function onboardingRedirect(message: string, kind: "erro" | "sucesso" = "erro"): never {
  redirect(`/onboarding?${kind}=${encodeURIComponent(message)}`);
}

async function requestIpHash(userId: string) {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || requestHeaders.get("x-real-ip") || `user:${userId}`;
  return createHash("sha256").update(`gril-access-rate:${ip}`).digest("hex");
}

async function recordRateEvent(userId: string, eventType: "organization_request" | "invalid_code") {
  const admin = createAdminClient();
  return admin.rpc("record_access_rate_event", {
    p_user_id: userId,
    p_ip_hash: await requestIpHash(userId),
    p_event_type: eventType,
  });
}

function accessError(message?: string) {
  if (message?.includes("cooldown")) return "Aguarde 7 dias antes de repetir esta solicitação.";
  if (message?.includes("rate_limited")) return "Limite temporário atingido. Tente novamente mais tarde.";
  if (message?.includes("whatsapp_already_in_use")) return "Este WhatsApp já está vinculado a outra conta ou solicitação.";
  if (message?.includes("request_open")) return "Esta conta já possui uma solicitação em andamento.";
  if (message?.includes("account_already")) return "Esta conta já está vinculada a uma imobiliária.";
  if (message?.includes("requests_blocked")) return "Esta conta não pode abrir novas solicitações. Fale com o suporte.";
  return "Não foi possível registrar a solicitação. Revise os dados e tente novamente.";
}

export async function lookupOrganizationAction(formData: FormData) {
  const parsed = joinCodeSchema.safeParse(formData.get("joinCode"));
  if (!parsed.success) onboardingRedirect("Use o código de 8 letras e números informado pela imobiliária.");
  const viewer = await requireViewer();
  if (viewer.membership || viewer.platformRole) onboardingRedirect("Esta conta não pode abrir uma nova solicitação.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lookup_organization_join_code", { p_code: parsed.data });
  if (error || !data?.length) {
    const rate = await recordRateEvent(viewer.userId, "invalid_code");
    if (rate.error) onboardingRedirect("Muitas tentativas inválidas. Aguarde alguns minutos.");
    onboardingRedirect("Código não encontrado ou temporariamente indisponível.");
  }
  redirect(`/onboarding?codigo=${encodeURIComponent(parsed.data)}`);
}

export async function submitOrganizationRequestAction(formData: FormData) {
  const parsed = z.object({
    whatsapp: phoneSchema,
    organizationName: z.string().trim().min(2).max(120),
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
    cnpj: z.string().trim().max(30).optional(),
    creci: z.string().trim().max(60).optional(),
    approximateBrokers: z.union([z.coerce.number().int().min(0).max(100000), z.literal("")]).optional(),
    operationDescription: z.string().trim().max(2000).optional(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) onboardingRedirect("Revise WhatsApp, nome da imobiliária, cidade e UF.");
  const viewer = await requireViewer();
  const rate = await recordRateEvent(viewer.userId, "organization_request");
  if (rate.error) onboardingRedirect("Limite diário de solicitações atingido para esta rede.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_access_request", {
    p_request_type: "create_organization",
    p_whatsapp_e164: parsed.data.whatsapp,
    p_organization_name: parsed.data.organizationName,
    p_city: parsed.data.city,
    p_state: parsed.data.state,
    p_cnpj: parsed.data.cnpj || undefined,
    p_creci: parsed.data.creci || undefined,
    p_approximate_brokers: parsed.data.approximateBrokers === "" ? undefined : parsed.data.approximateBrokers,
    p_operation_description: parsed.data.operationDescription || undefined,
  });
  if (error) onboardingRedirect(accessError(error.message));
  revalidatePath("/onboarding");
  onboardingRedirect("Solicitação enviada para análise.", "sucesso");
}

export async function submitMembershipRequestAction(formData: FormData) {
  const parsed = z.object({
    joinCode: joinCodeSchema,
    role: z.enum(["manager", "broker"]),
    whatsapp: phoneSchema,
    introduction: z.string().trim().max(1000).optional(),
    confirmOrganization: z.literal("yes"),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) onboardingRedirect("Confirme a imobiliária e revise seus dados.");
  await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_access_request", {
    p_request_type: parsed.data.role === "manager" ? "join_manager" : "join_broker",
    p_whatsapp_e164: parsed.data.whatsapp,
    p_join_code: parsed.data.joinCode,
    p_introduction: parsed.data.introduction || undefined,
  });
  if (error) onboardingRedirect(accessError(error.message));
  revalidatePath("/onboarding");
  onboardingRedirect("Solicitação enviada ao responsável pela imobiliária.", "sucesso");
}

export async function resubmitAccessRequestAction(formData: FormData) {
  const parsed = z.object({
    requestId: z.string().uuid(),
    whatsapp: phoneSchema,
    introduction: z.string().trim().max(1000).optional(),
    organizationName: z.string().trim().max(120).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().toUpperCase().max(2).optional(),
    cnpj: z.string().trim().max(30).optional(),
    creci: z.string().trim().max(60).optional(),
    approximateBrokers: z.union([z.coerce.number().int().min(0).max(100000), z.literal("")]).optional(),
    operationDescription: z.string().trim().max(2000).optional(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) onboardingRedirect("Revise os campos solicitados para correção.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("resubmit_access_request", {
    p_request_id: parsed.data.requestId,
    p_whatsapp_e164: parsed.data.whatsapp,
    p_introduction: parsed.data.introduction || undefined,
    p_organization_name: parsed.data.organizationName || undefined,
    p_city: parsed.data.city || undefined,
    p_state: parsed.data.state || undefined,
    p_cnpj: parsed.data.cnpj || undefined,
    p_creci: parsed.data.creci || undefined,
    p_approximate_brokers: parsed.data.approximateBrokers === "" ? undefined : parsed.data.approximateBrokers,
    p_operation_description: parsed.data.operationDescription || undefined,
  });
  if (error) onboardingRedirect(accessError(error.message));
  revalidatePath("/onboarding");
  onboardingRedirect("Correções reenviadas para análise.", "sucesso");
}

export async function cancelAccessRequestAction(formData: FormData) {
  const requestId = z.string().uuid().safeParse(formData.get("requestId"));
  if (!requestId.success) onboardingRedirect("Solicitação inválida.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_access_request", { p_request_id: requestId.data });
  if (error) onboardingRedirect("Esta solicitação não pode mais ser cancelada.");
  revalidatePath("/onboarding");
  onboardingRedirect("Solicitação cancelada.", "sucesso");
}

export async function bootstrapOrganizationAction(formData: FormData) {
  const parsed = z.object({
    accessRequestId: z.string().uuid(),
    organizationName: z.string().trim().min(2).max(120),
    operationName: z.string().trim().min(2).max(120),
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
    timezone: timezoneSchema,
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) onboardingRedirect("Revise os dados finais da imobiliária e da operação.");
  const viewer = await requireViewer();
  if (viewer.membership?.status === "active") redirect("/app");
  if (viewer.membership || viewer.platformRole) onboardingRedirect("Esta conta não pode criar uma imobiliária.");
  const supabase = await createClient();
  const { error } = await supabase.from("organization_bootstrap_requests").insert({
    actor_user_id: viewer.userId,
    access_request_id: parsed.data.accessRequestId,
    organization_name: parsed.data.organizationName,
    operation_name: parsed.data.operationName,
    city: parsed.data.city,
    state: parsed.data.state,
    timezone: parsed.data.timezone,
  });
  if (error) onboardingRedirect("A autorização expirou, foi revogada ou já foi utilizada.");
  revalidatePath("/app", "layout");
  redirect("/app/configuracoes/organizacao?sucesso=operacao-criada");
}
