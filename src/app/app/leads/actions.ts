"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireActiveViewer } from "@/lib/auth/session";
import { leadSchema, normalizePhoneToE164 } from "@/lib/crm/phone";
import { createClient } from "@/lib/supabase/server";

const stageChangeSchema = z.object({
  opportunityId: z.string().uuid(),
  targetStageId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().positive(),
  reason: z.string().trim().max(500).optional(),
  lossReasonId: z.string().uuid().optional().or(z.literal("")),
  saleProjectName: z.string().trim().max(160).optional(),
  saleValue: z.string().trim().optional(),
  saleMonth: z.string().trim().optional(),
  saleYear: z.string().trim().optional(),
  nextActionDescription: z.string().trim().max(500).optional(),
  nextActionDueAt: z.string().trim().optional(),
});

function queryMessage(message: string) {
  return encodeURIComponent(message);
}

function crmError(message: string | undefined) {
  if (message?.includes("opportunity_version_conflict")) {
    return "Este lead foi alterado em outra sessão. Recarregue e tente novamente.";
  }
  if (message?.includes("invalid_stage_transition")) {
    return "Essa mudança de etapa não é permitida.";
  }
  if (message?.includes("active_loss_reason_required")) {
    return "Escolha o motivo da perda.";
  }
  if (message?.includes("sale_month_and_year_required")) {
    return "Informe mês e ano da venda.";
  }
  return "Não foi possível concluir a operação.";
}

export async function createLeadAction(formData: FormData) {
  const parsed = leadSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    source: formData.get("source"),
    operationId: formData.get("operationId"),
    assignedMembershipId: formData.get("assignedMembershipId") || "",
    aiContext: formData.get("aiContext") || undefined,
    internalNote: formData.get("internalNote") || undefined,
    shareContextWithBroker: formData.get("shareContextWithBroker") === "on",
    desiredAction: formData.get("desiredAction"),
    authorizationConfirmed: formData.get("authorizationConfirmed") === "on",
  });

  if (!parsed.success) {
    redirect(`/app/leads?erro=${queryMessage(parsed.error.issues[0]?.message ?? "Revise os dados.")}`);
  }

  const viewer = await requireActiveViewer();
  const operation = viewer.operations.find(
    (item) => item.id === parsed.data.operationId,
  );
  if (!operation || operation.org_id !== viewer.organization!.id) {
    redirect(`/app/leads?erro=${queryMessage("Operação indisponível.")}`);
  }

  const phoneE164 = normalizePhoneToE164(parsed.data.phone);
  if (!phoneE164) {
    redirect(`/app/leads?erro=${queryMessage("WhatsApp inválido.")}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_creation_requests")
    .insert({
      org_id: viewer.organization!.id,
      operation_id: operation.id,
      actor_user_id: viewer.userId,
      name: parsed.data.name,
      phone_original: parsed.data.phone,
      phone_e164: phoneE164,
      source: parsed.data.source,
      assigned_membership_id: parsed.data.assignedMembershipId || null,
      ai_context: parsed.data.aiContext || null,
      internal_note: parsed.data.internalNote || null,
      share_context_with_broker: parsed.data.shareContextWithBroker,
      desired_action: parsed.data.desiredAction,
      authorization_confirmed: parsed.data.authorizationConfirmed,
    })
    .select("opportunity_id, reused_contact, reused_opportunity")
    .single();

  if (error || !data?.opportunity_id) {
    redirect(`/app/leads?erro=${queryMessage(crmError(error?.message))}`);
  }

  revalidatePath("/app/leads");
  revalidatePath("/app/kanban");
  const status = data.reused_opportunity ? "oportunidade-reutilizada" : "lead-criado";
  redirect(`/app/leads/${data.opportunity_id}?sucesso=${status}`);
}

export async function changeStageAction(formData: FormData) {
  const parsed = stageChangeSchema.safeParse({
    opportunityId: formData.get("opportunityId"),
    targetStageId: formData.get("targetStageId"),
    expectedVersion: formData.get("expectedVersion"),
    reason: formData.get("reason") || undefined,
    lossReasonId: formData.get("lossReasonId") || "",
    saleProjectName: formData.get("saleProjectName") || undefined,
    saleValue: formData.get("saleValue") || undefined,
    saleMonth: formData.get("saleMonth") || undefined,
    saleYear: formData.get("saleYear") || undefined,
    nextActionDescription: formData.get("nextActionDescription") || undefined,
    nextActionDueAt: formData.get("nextActionDueAt") || undefined,
  });

  if (!parsed.success) return;
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("id, org_id")
    .eq("id", parsed.data.opportunityId)
    .maybeSingle();

  if (!opportunity || opportunity.org_id !== viewer.organization!.id) return;

  const value = parsed.data.saleValue
    ? Number(parsed.data.saleValue.replace(",", "."))
    : null;
  const { error } = await supabase
    .from("opportunity_stage_change_requests")
    .insert({
      org_id: viewer.organization!.id,
      opportunity_id: opportunity.id,
      target_stage_id: parsed.data.targetStageId,
      actor_user_id: viewer.userId,
      expected_version: parsed.data.expectedVersion,
      reason: parsed.data.reason || null,
      loss_reason_id: parsed.data.lossReasonId || null,
      sale_project_name: parsed.data.saleProjectName || null,
      sale_value: Number.isFinite(value) ? value : null,
      sale_month: parsed.data.saleMonth ? Number(parsed.data.saleMonth) : null,
      sale_year: parsed.data.saleYear ? Number(parsed.data.saleYear) : null,
      next_action_description: parsed.data.nextActionDescription || null,
      next_action_due_at: parsed.data.nextActionDueAt
        ? new Date(parsed.data.nextActionDueAt).toISOString()
        : null,
    });

  if (error) {
    redirect(`/app/leads/${opportunity.id}?erro=${queryMessage(crmError(error.message))}`);
  }

  revalidatePath(`/app/leads/${opportunity.id}`);
  revalidatePath("/app/leads");
  revalidatePath("/app/kanban");
  redirect(`/app/leads/${opportunity.id}?sucesso=etapa-atualizada`);
}

export async function completeNextActionAction(formData: FormData) {
  const actionId = z.string().uuid().safeParse(formData.get("actionId"));
  const opportunityId = z.string().uuid().safeParse(formData.get("opportunityId"));
  if (!actionId.success || !opportunityId.success) return;

  await requireActiveViewer();
  const supabase = await createClient();
  await supabase
    .from("next_actions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", actionId.data)
    .eq("opportunity_id", opportunityId.data)
    .eq("status", "open");

  revalidatePath(`/app/leads/${opportunityId.data}`);
}

