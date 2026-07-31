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
  saleUnitReference: z.string().trim().max(120).optional(),
  saleUnitQuantity: z.string().trim().optional(),
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
  if (message?.includes("phone_already_in_use")) return "Esse telefone já pertence a outro contato ativo.";
  if (message?.includes("contact_requires_active_phone")) return "O contato precisa manter ao menos um telefone ativo.";
  if (message?.includes("contacts_have_active_conversations")) return "A fusão está bloqueada porque os dois contatos têm conversas ativas.";
  if (message?.includes("checklist_waiver_reason_required")) return "Informe o motivo da dispensa do item.";
  if (message?.includes("required_checklist_incomplete")) return "Conclua ou dispense os itens obrigatórios do checklist antes de avançar.";
  if (message?.includes("sale_confirmation_manager_required")) return "Somente dono ou gestor pode confirmar a venda.";
  if (message?.includes("sale_unit_and_quantity_required")) return "Informe a unidade e a quantidade vendida.";
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
    saleUnitReference: formData.get("saleUnitReference") || undefined,
    saleUnitQuantity: formData.get("saleUnitQuantity") || undefined,
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
      sale_unit_reference: parsed.data.saleUnitReference || null,
      sale_unit_quantity: parsed.data.saleUnitQuantity ? Number(parsed.data.saleUnitQuantity) : null,
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

export async function recordQualificationAction(formData: FormData) {
  const parsed = z.object({
    opportunityId: z.string().uuid(),
    definitionId: z.string().uuid(),
    answerType: z.enum(["money", "number", "text", "single_choice", "multi_choice", "boolean", "datetime_preference"]),
    value: z.string().trim().min(1).max(1000),
    expectedVersion: z.coerce.number().int().positive().optional(),
  }).safeParse({
    opportunityId: formData.get("opportunityId"),
    definitionId: formData.get("definitionId"),
    answerType: formData.get("answerType"),
    value: formData.get("value"),
    expectedVersion: formData.get("expectedVersion") || undefined,
  });
  if (!parsed.success) return;
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const numeric = ["money", "number"].includes(parsed.data.answerType)
    ? Number(parsed.data.value.replace(/[^0-9,.-]/g, "").replace(",", "."))
    : null;
  const { error } = await supabase.from("qualification_value_requests").insert({
    org_id: viewer.organization!.id,
    opportunity_id: parsed.data.opportunityId,
    definition_id: parsed.data.definitionId,
    value_number: numeric !== null && Number.isFinite(numeric) ? numeric : null,
    value_text: numeric === null ? parsed.data.value : null,
    source: "manual",
    confidence: 1,
    human_confirmed: true,
    actor_user_id: viewer.userId,
    expected_version: parsed.data.expectedVersion ?? null,
  });
  if (error) {
    redirect(`/app/leads/${parsed.data.opportunityId}?erro=${queryMessage(crmError(error.message))}`);
  }
  revalidatePath(`/app/leads/${parsed.data.opportunityId}`);
}

export async function matchProjectsAction(formData: FormData) {
  const opportunityId = z.string().uuid().safeParse(formData.get("opportunityId"));
  if (!opportunityId.success) return;
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  await supabase.from("project_match_requests").insert({
    org_id: viewer.organization!.id,
    opportunity_id: opportunityId.data,
    actor_user_id: viewer.userId,
  });
  revalidatePath(`/app/leads/${opportunityId.data}`);
}

export async function addContactPhoneAction(formData: FormData) {
  const parsed = z.object({
    opportunityId: z.string().uuid(),
    contactId: z.string().uuid(),
    phone: z.string().trim().min(8).max(40),
    makePrimary: z.boolean(),
  }).safeParse({
    opportunityId: formData.get("opportunityId"),
    contactId: formData.get("contactId"),
    phone: formData.get("phone"),
    makePrimary: formData.get("makePrimary") === "on",
  });
  if (!parsed.success) return;
  const phoneE164 = normalizePhoneToE164(parsed.data.phone);
  if (!phoneE164) redirect(`/app/leads/${parsed.data.opportunityId}?erro=${queryMessage("Telefone inválido.")}`);
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { error } = await supabase.from("contact_phone_requests").insert({
    org_id: viewer.organization!.id,
    contact_id: parsed.data.contactId,
    action: "add",
    phone_e164: phoneE164,
    phone_original: parsed.data.phone,
    make_primary: parsed.data.makePrimary,
    actor_user_id: viewer.userId,
  });
  if (error) redirect(`/app/leads/${parsed.data.opportunityId}?erro=${queryMessage(crmError(error.message))}`);
  revalidatePath(`/app/leads/${parsed.data.opportunityId}`);
  redirect(`/app/leads/${parsed.data.opportunityId}?sucesso=telefone-adicionado`);
}

export async function updateContactPhoneAction(formData: FormData) {
  const parsed = z.object({
    opportunityId: z.string().uuid(), contactId: z.string().uuid(), phoneId: z.string().uuid(),
    action: z.enum(["set_primary", "deactivate", "mark_wrong"]),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { error } = await supabase.from("contact_phone_requests").insert({
    org_id: viewer.organization!.id, contact_id: parsed.data.contactId, phone_id: parsed.data.phoneId,
    action: parsed.data.action, actor_user_id: viewer.userId,
  });
  if (error) redirect(`/app/leads/${parsed.data.opportunityId}?erro=${queryMessage(crmError(error.message))}`);
  revalidatePath(`/app/leads/${parsed.data.opportunityId}`);
  redirect(`/app/leads/${parsed.data.opportunityId}?sucesso=telefone-atualizado`);
}

export async function updateParticipantAction(formData: FormData) {
  const parsed = z.object({
    opportunityId: z.string().uuid(), contactId: z.string().uuid(),
    action: z.enum(["add", "remove"]), role: z.enum(["co_buyer", "influencer", "other"]),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { error } = await supabase.from("opportunity_participant_requests").insert({
    org_id: viewer.organization!.id, opportunity_id: parsed.data.opportunityId, contact_id: parsed.data.contactId,
    action: parsed.data.action, role: parsed.data.role, actor_user_id: viewer.userId,
  });
  if (error) redirect(`/app/leads/${parsed.data.opportunityId}?erro=${queryMessage(crmError(error.message))}`);
  revalidatePath(`/app/leads/${parsed.data.opportunityId}`);
  redirect(`/app/leads/${parsed.data.opportunityId}?sucesso=participantes-atualizados`);
}

export async function mergeContactAction(formData: FormData) {
  const parsed = z.object({
    opportunityId: z.string().uuid(), sourceContactId: z.string().uuid(), targetContactId: z.string().uuid(),
    reason: z.string().trim().min(5).max(500),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { error } = await supabase.from("contact_merge_requests").insert({
    org_id: viewer.organization!.id, source_contact_id: parsed.data.sourceContactId,
    target_contact_id: parsed.data.targetContactId, reason: parsed.data.reason, actor_user_id: viewer.userId,
  });
  if (error) redirect(`/app/leads/${parsed.data.opportunityId}?erro=${queryMessage(crmError(error.message))}`);
  revalidatePath("/app/leads"); revalidatePath("/app/kanban");
  redirect(`/app/leads?sucesso=contatos-fundidos`);
}

export async function updateChecklistAction(formData: FormData) {
  const parsed = z.object({
    opportunityId: z.string().uuid(), checklistId: z.string().uuid(), itemId: z.string().uuid(),
    action: z.enum(["complete", "reopen", "waive"]), note: z.string().trim().max(1000).optional(),
  }).safeParse({ ...Object.fromEntries(formData), note: formData.get("note") || undefined });
  if (!parsed.success) return;
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { error } = await supabase.from("checklist_update_requests").insert({
    org_id: viewer.organization!.id, opportunity_checklist_id: parsed.data.checklistId,
    item_id: parsed.data.itemId, action: parsed.data.action, note: parsed.data.note ?? null, actor_user_id: viewer.userId,
  });
  if (error) redirect(`/app/leads/${parsed.data.opportunityId}?erro=${queryMessage(crmError(error.message))}`);
  revalidatePath(`/app/leads/${parsed.data.opportunityId}`);
}

export async function updatePurchaseStructureAction(formData: FormData) {
  const parsed = z.object({ opportunityId: z.string().uuid(), unitQuantity: z.coerce.number().int().min(1).max(100), amountScope: z.enum(["total", "per_unit"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { error } = await supabase.from("opportunity_purchase_structure_requests").insert({
    org_id: viewer.organization!.id, opportunity_id: parsed.data.opportunityId, unit_quantity: parsed.data.unitQuantity,
    amount_scope: parsed.data.amountScope, actor_user_id: viewer.userId,
  });
  if (error) redirect(`/app/leads/${parsed.data.opportunityId}?erro=${queryMessage(crmError(error.message))}`);
  revalidatePath(`/app/leads/${parsed.data.opportunityId}`); revalidatePath("/app/kanban");
}
