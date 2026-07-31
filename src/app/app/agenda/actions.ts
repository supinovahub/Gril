"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

function agendaRedirect(message: string, kind: "erro" | "sucesso" = "erro"): never {
  redirect(`/app/agenda?${kind}=${encodeURIComponent(message)}`);
}

export async function updateCallSettingsAction(formData: FormData) {
  const viewer = await requireActiveViewer();
  if (!viewer.membership) agendaRedirect("Membership não encontrada.");
  const operation = viewer.operations.find((item) => item.is_default) ?? viewer.operations[0];
  if (!operation) agendaRedirect("Operação não encontrada.");
  const supabase = await createClient();
  const { error } = await supabase.from("call_settings_requests").insert({
    org_id: viewer.organization!.id, operation_id: operation.id, membership_id: viewer.membership.id,
    can_receive_calls: formData.get("canReceiveCalls") === "on",
    is_preferred_receiver: false,
    receive_urgent_call_alerts: formData.get("urgentAlerts") === "on",
    actor_user_id: viewer.userId,
  });
  if (error) agendaRedirect("Não foi possível atualizar sua participação na distribuição.");
  revalidatePath("/app/agenda"); agendaRedirect("Preferências de calls atualizadas.", "sucesso");
}

export async function addAvailabilityAction(formData: FormData) {
  const parsed = z.object({ weekday: z.coerce.number().int().min(0).max(6), startTime: z.string().regex(/^\d{2}:\d{2}$/), endTime: z.string().regex(/^\d{2}:\d{2}$/) }).safeParse({ weekday: formData.get("weekday"), startTime: formData.get("startTime"), endTime: formData.get("endTime") });
  if (!parsed.success || parsed.data.endTime <= parsed.data.startTime) agendaRedirect("Período de disponibilidade inválido.");
  const viewer = await requireActiveViewer(); const operation = viewer.operations.find((item) => item.is_default) ?? viewer.operations[0];
  if (!viewer.membership || !operation) agendaRedirect("Operação não encontrada.");
  const supabase = await createClient();
  const { error } = await supabase.from("availability_rules").insert({ org_id: viewer.organization!.id, operation_id: operation.id, membership_id: viewer.membership.id, weekday: parsed.data.weekday, start_time: parsed.data.startTime, end_time: parsed.data.endTime, timezone: operation.timezone, valid_from: new Date().toISOString().slice(0,10) });
  if (error) agendaRedirect("Não foi possível salvar o período.");
  revalidatePath("/app/agenda"); agendaRedirect("Disponibilidade adicionada.", "sucesso");
}

export async function createCallAction(formData: FormData) {
  const parsed = z.object({ opportunityRef: z.string().regex(/^[0-9a-f-]{36}:[1-9][0-9]*$/), startsAt: z.string().min(16), format: z.enum(["video","phone","unknown"]), leadConfirmed: z.literal("on") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) agendaRedirect("Revise oportunidade, data e confirmação do lead.");
  const [opportunityId, versionText] = parsed.data.opportunityRef.split(":");
  const startsAt = new Date(`${parsed.data.startsAt}:00-03:00`);
  if (Number.isNaN(startsAt.getTime())) agendaRedirect("Data inválida.");
  const viewer = await requireActiveViewer(); const operation = viewer.operations.find((item) => item.is_default) ?? viewer.operations[0];
  if (!operation) agendaRedirect("Operação não encontrada.");
  const supabase = await createClient();
  const { error } = await supabase.from("call_creation_requests").insert({ org_id: viewer.organization!.id, operation_id: operation.id, opportunity_id: opportunityId, starts_at: startsAt.toISOString(), format: parsed.data.format, lead_confirmed: true, expected_opportunity_version: Number(versionText), actor_user_id: viewer.userId });
  if (error) agendaRedirect(error.message.includes("too_close") ? "Use pelo menos 10 minutos; abaixo de uma hora a call irá para o gestor." : "Não foi possível separar o horário.");
  revalidatePath("/app/agenda"); agendaRedirect("Horário separado. Inicie a distribuição.", "sucesso");
}

export async function distributeCallAction(formData: FormData) {
  const callId = z.string().uuid().safeParse(formData.get("callId")); if (!callId.success) agendaRedirect("Call inválida.");
  const viewer = await requireActiveViewer(); const supabase = await createClient();
  const { error } = await supabase.from("call_distribution_requests").insert({ org_id: viewer.organization!.id, call_id: callId.data, actor_user_id: viewer.userId });
  if (error) agendaRedirect("Não foi possível distribuir: revise agenda, WhatsApp, lead time e estado.");
  revalidatePath("/app/agenda"); agendaRedirect("Distribuição iniciada.", "sucesso");
}

export async function acceptOfferAction(formData: FormData) {
  const parsed = z.object({ callId: z.string().uuid(), offerId: z.string().uuid(), expectedVersion: z.coerce.number().int().positive() }).safeParse({ callId: formData.get("callId"), offerId: formData.get("offerId"), expectedVersion: formData.get("expectedVersion") });
  if (!parsed.success) agendaRedirect("Oferta inválida.");
  const viewer = await requireActiveViewer(); const supabase = await createClient();
  const { error } = await supabase.from("call_offer_accept_requests").insert({ org_id: viewer.organization!.id, call_id: parsed.data.callId, offer_id: parsed.data.offerId, expected_call_version: parsed.data.expectedVersion, actor_user_id: viewer.userId });
  if (error) agendaRedirect("Esta oferta já venceu, foi aceita ou conflita com sua agenda.");
  revalidatePath("/app/agenda"); revalidatePath("/app/leads"); agendaRedirect("Call atribuída a você.", "sucesso");
}

export async function recordCallResultAction(formData: FormData) {
  const parsed = z.object({ callId: z.string().uuid(), expectedVersion: z.coerce.number().int().positive(), result: z.enum(["start_negotiation","lost","no_show","no_result","reschedule"]), reason: z.string().trim().max(1000).optional(), context: z.string().trim().max(4000).optional(), nextAction: z.string().trim().max(1000).optional() }).safeParse({ callId: formData.get("callId"), expectedVersion: formData.get("expectedVersion"), result: formData.get("result"), reason: formData.get("reason") || undefined, context: formData.get("context") || undefined, nextAction: formData.get("nextAction") || undefined });
  if (!parsed.success) agendaRedirect("Resultado inválido.");
  const viewer = await requireActiveViewer(); const supabase = await createClient();
  const { error } = await supabase.from("call_result_requests").insert({ org_id: viewer.organization!.id, call_id: parsed.data.callId, expected_call_version: parsed.data.expectedVersion, result: parsed.data.result, reason: parsed.data.reason ?? null, context: parsed.data.context ?? null, next_action: parsed.data.nextAction ?? null, actor_user_id: viewer.userId });
  if (error) agendaRedirect("Resultado recusado: a call ainda não começou, mudou ou já foi concluída.");
  revalidatePath("/app/agenda"); revalidatePath("/app/kanban"); agendaRedirect("Resultado registrado.", "sucesso");
}
