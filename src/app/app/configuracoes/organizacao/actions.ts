"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireActiveViewer } from "@/lib/auth/session";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

function settingsRedirect(message: string, kind: "erro" | "sucesso" = "erro"): never {
  redirect(`/app/configuracoes/organizacao?${kind}=${encodeURIComponent(message)}`);
}

export async function updateInstitutionalSettingsAction(formData: FormData) {
  const parsed = z.object({
    organizationName: z.string().trim().min(2).max(120),
    companyName: z.string().trim().min(2).max(160),
    cnpj: z.string().trim().max(30).optional(),
    creci: z.string().trim().min(2).max(80),
    address: z.string().trim().max(500).optional(),
    site: z.string().trim().url().optional().or(z.literal("")),
    instagram: z.string().trim().max(160).optional(),
    privacyContact: z.string().trim().min(3).max(200),
    sourceName: z.string().trim().min(2).max(200),
    validUntil: z.string().date(),
    aiMonthlyBudget: z.coerce.number().nonnegative().max(1_000_000).optional(),
  }).safeParse({
    organizationName: formData.get("organizationName"), companyName: formData.get("companyName"),
    cnpj: formData.get("cnpj") || undefined, creci: formData.get("creci"), address: formData.get("address") || undefined,
    site: formData.get("site") ?? "", instagram: formData.get("instagram") || undefined,
    privacyContact: formData.get("privacyContact"), sourceName: formData.get("sourceName"),
    validUntil: formData.get("validUntil"), aiMonthlyBudget: formData.get("aiMonthlyBudget") || undefined,
  });
  if (!parsed.success) settingsRedirect(parsed.error.issues[0]?.message ?? "Revise os dados institucionais.");
  const viewer = await requireActiveViewer();
  if (viewer.membership?.role !== "owner") settingsRedirect("Somente o dono altera a identidade institucional.");
  const supabase = await createClient();
  const profile: Json = {
    company_name: parsed.data.companyName, cnpj: parsed.data.cnpj ?? null, creci: parsed.data.creci,
    address: parsed.data.address ?? null, site: parsed.data.site || null, instagram: parsed.data.instagram ?? null,
    privacy_contact: parsed.data.privacyContact, source_name: parsed.data.sourceName,
    reference_date: new Date().toISOString().slice(0, 10), valid_until: parsed.data.validUntil,
  };
  const [organizationResult, settingsResult] = await Promise.all([
    supabase.from("organizations").update({ name: parsed.data.organizationName }).eq("id", viewer.organization!.id),
    supabase.from("organization_settings").update({ institutional_profile: profile, ai_monthly_budget_brl: parsed.data.aiMonthlyBudget ?? null }).eq("org_id", viewer.organization!.id),
  ]);
  if (organizationResult.error || settingsResult.error) settingsRedirect("Não foi possível salvar a configuração institucional.");
  revalidatePath("/app", "layout");
  settingsRedirect("Identidade institucional atualizada.", "sucesso");
}

export async function updateOperationSettingsAction(formData: FormData) {
  const parsed = z.object({
    operationId: z.string().uuid(), operationName: z.string().trim().min(2).max(120),
    timezone: z.enum(["America/Sao_Paulo", "America/Manaus", "America/Cuiaba", "America/Rio_Branco"]), inboundStart: z.string().regex(/^\d{2}:\d{2}$/),
    inboundEnd: z.string().regex(/^\d{2}:\d{2}$/), campaignStart: z.string().regex(/^\d{2}:\d{2}$/),
    campaignEnd: z.string().regex(/^\d{2}:\d{2}$/), proactiveRate: z.coerce.number().int().min(1).max(10),
    groupingSeconds: z.coerce.number().int().min(1).max(30), maxGroupingSeconds: z.coerce.number().int().min(10).max(60),
    operationalPhone: z.string().trim().regex(/^\+[1-9][0-9]{7,14}$/).optional().or(z.literal("")),
  }).refine((value) => value.maxGroupingSeconds >= value.groupingSeconds, { message: "O agrupamento máximo deve ser maior que a espera inicial." })
    .refine((value) => value.inboundEnd > value.inboundStart && value.campaignEnd > value.campaignStart, { message: "O fim das janelas deve ser posterior ao início." })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) settingsRedirect(parsed.error.issues[0]?.message ?? "Revise as regras da operação.");
  const viewer = await requireActiveViewer();
  const canManage = viewer.membership?.role === "owner" || viewer.permissions.includes("settings.manage");
  if (!canManage || !viewer.operations.some((operation) => operation.id === parsed.data.operationId)) settingsRedirect("Sem permissão para alterar esta operação.");
  const supabase = await createClient();
  const [operationResult, settingsResult] = await Promise.all([
    supabase.from("operations").update({ name: parsed.data.operationName, timezone: parsed.data.timezone }).eq("id", parsed.data.operationId).eq("org_id", viewer.organization!.id),
    supabase.from("operation_settings").update({
      business_hours: { timezone: parsed.data.timezone, days: {} }, inbound_window_start: parsed.data.inboundStart,
      inbound_window_end: parsed.data.inboundEnd, campaign_window_start: parsed.data.campaignStart,
      campaign_window_end: parsed.data.campaignEnd, proactive_openings_per_minute: parsed.data.proactiveRate,
      grouping_seconds: parsed.data.groupingSeconds, max_grouping_seconds: parsed.data.maxGroupingSeconds,
      operational_phone_e164: parsed.data.operationalPhone || null,
    }).eq("operation_id", parsed.data.operationId).eq("org_id", viewer.organization!.id),
  ]);
  if (operationResult.error || settingsResult.error) settingsRedirect("Não foi possível salvar a configuração operacional.");
  revalidatePath("/app", "layout");
  settingsRedirect("Regras operacionais atualizadas.", "sucesso");
}

export async function emergencyPauseAction(formData: FormData) {
  const parsed = z.object({ operationId: z.string().uuid(), reason: z.string().trim().min(5).max(500) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) settingsRedirect("Explique o motivo da pausa emergencial.");
  const viewer = await requireActiveViewer();
  const canPause = viewer.membership?.role === "owner" || viewer.permissions.includes("settings.manage");
  if (!canPause) settingsRedirect("Sem permissão para pausar a operação.");
  const supabase = await createClient();
  const { error } = await supabase.from("system_pauses").insert({
    org_id: viewer.organization!.id, operation_id: parsed.data.operationId, scope_type: "organization",
    reason: parsed.data.reason, source: "manual", paused_by: viewer.userId,
  });
  if (error) settingsRedirect("Não foi possível ativar a pausa emergencial.");
  revalidatePath("/app", "layout");
  settingsRedirect("Pausa emergencial ativada.", "sucesso");
}

export async function resumeEmergencyPauseAction(formData: FormData) {
  const parsed = z.object({
    pauseId: z.string().uuid(),
    reason: z.string().trim().min(5).max(500),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) settingsRedirect("Informe o motivo da retomada.");
  const viewer = await requireActiveViewer();
  if (viewer.membership?.role !== "owner") settingsRedirect("Somente o dono pode retomar a operação.");
  const supabase = await createClient();
  const { data: pause } = await supabase.from("system_pauses").select("metadata").eq("id", parsed.data.pauseId).eq("org_id", viewer.organization!.id).eq("active", true).maybeSingle();
  if (!pause) settingsRedirect("A pausa já foi encerrada ou não existe.");
  const metadata = pause.metadata && typeof pause.metadata === "object" && !Array.isArray(pause.metadata) ? pause.metadata : {};
  const { error } = await supabase.from("system_pauses").update({
    active: false, resumed_at: new Date().toISOString(), resumed_by: viewer.userId,
    metadata: { ...metadata, resume_reason: parsed.data.reason },
  }).eq("id", parsed.data.pauseId).eq("org_id", viewer.organization!.id).eq("active", true);
  if (error) settingsRedirect("Não foi possível retomar a operação.");
  revalidatePath("/app", "layout");
  settingsRedirect("Operação retomada pelo dono.", "sucesso");
}
