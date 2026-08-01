"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const projectSchema = z.object({
  name: z.string().trim().min(2).max(160),
  region: z.string().trim().min(2).max(160),
  neighborhood: z.string().trim().max(160).optional(),
  summary: z.string().trim().min(20).max(4000),
  deliveryType: z.enum(["ready", "under_construction", "launch", "mixed"]),
  minPrice: z.coerce.number().nonnegative(),
  maxPrice: z.coerce.number().nonnegative(),
  minDownPayment: z.coerce.number().nonnegative(),
  sourceName: z.string().trim().min(2).max(160),
  validUntil: z.string().date(),
  coverStoragePath: z.string().trim().min(3).max(500),
  activate: z.boolean(),
});

export async function createProjectAction(formData: FormData) {
  const parsed = projectSchema.safeParse({
    name: formData.get("name"), region: formData.get("region"), neighborhood: formData.get("neighborhood") || undefined,
    summary: formData.get("summary"), deliveryType: formData.get("deliveryType"), minPrice: formData.get("minPrice"),
    maxPrice: formData.get("maxPrice"), minDownPayment: formData.get("minDownPayment"), sourceName: formData.get("sourceName"),
    validUntil: formData.get("validUntil"), coverStoragePath: formData.get("coverStoragePath"), activate: formData.get("activate") === "on",
  });
  if (!parsed.success) {
    redirect(`/app/conhecimento?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Revise os campos.")}`);
  }
  if (parsed.data.maxPrice < parsed.data.minPrice) {
    redirect(`/app/conhecimento?erro=${encodeURIComponent("Preço máximo deve ser maior que o mínimo.")}`);
  }
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const operation = viewer.operations.find((item) => item.is_default) ?? viewer.operations[0];
  const { error } = await supabase.from("projects").insert({
    org_id: viewer.organization!.id,
    operation_id: operation?.id ?? null,
    name: parsed.data.name,
    region: parsed.data.region,
    neighborhood: parsed.data.neighborhood || null,
    summary: parsed.data.summary,
    delivery_type: parsed.data.deliveryType,
    min_price: parsed.data.minPrice,
    max_price: parsed.data.maxPrice,
    min_down_payment: parsed.data.minDownPayment,
    source_name: parsed.data.sourceName,
    reference_date: new Date().toISOString().slice(0, 10),
    valid_until: parsed.data.validUntil,
    cover_storage_path: parsed.data.coverStoragePath,
    status: parsed.data.activate ? "active" : "draft",
    recommendable: parsed.data.activate,
    created_by: viewer.userId,
  });
  if (error) redirect(`/app/conhecimento?erro=${encodeURIComponent("Não foi possível salvar o empreendimento.")}`);
  revalidatePath("/app/conhecimento");
  redirect("/app/conhecimento?sucesso=empreendimento-criado");
}

export async function createFaqAction(formData: FormData) {
  const parsed = z.object({
    question: z.string().trim().min(5).max(500),
    answer: z.string().trim().min(10).max(4000),
    responseMode: z.enum(["direct", "brief_then_call", "silent_escalation"]),
    sourceName: z.string().trim().min(2).max(160),
  }).safeParse({ question: formData.get("question"), answer: formData.get("answer"), responseMode: formData.get("responseMode"), sourceName: formData.get("sourceName") });
  if (!parsed.success) {
    redirect(`/app/conhecimento?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Revise a FAQ.")}`);
  }
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { error } = await supabase.from("faq_creation_requests").insert({
    org_id: viewer.organization!.id,
    canonical_question: parsed.data.question,
    base_answer: parsed.data.answer,
    response_mode: parsed.data.responseMode,
    source_name: parsed.data.sourceName,
    actor_user_id: viewer.userId,
  });
  if (error) redirect(`/app/conhecimento?erro=${encodeURIComponent("Não foi possível publicar a FAQ.")}`);
  revalidatePath("/app/conhecimento");
  redirect("/app/conhecimento?sucesso=faq-publicada");
}

export async function createProjectFactAction(formData: FormData) {
  const parsed = z.object({
    projectId: z.string().uuid(), code: z.string().trim().regex(/^[a-z0-9_]{2,80}$/),
    valueText: z.string().trim().min(1).max(2000), unit: z.string().trim().max(60).optional(),
    sourceName: z.string().trim().min(2).max(160), referenceDate: z.string().date(), validUntil: z.string().date().optional(),
  }).safeParse({ projectId: formData.get("projectId"), code: formData.get("code"), valueText: formData.get("valueText"),
    unit: formData.get("unit") || undefined, sourceName: formData.get("sourceName"), referenceDate: formData.get("referenceDate"), validUntil: formData.get("validUntil") || undefined });
  if (!parsed.success) redirect(`/app/conhecimento?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Revise o fato.")}`);
  if (parsed.data.validUntil && parsed.data.validUntil < parsed.data.referenceDate) redirect(`/app/conhecimento?erro=${encodeURIComponent("A validade deve ser posterior à data de referência.")}`);
  const viewer = await requireActiveViewer(); const supabase = await createClient();
  const { data: current } = await supabase.from("project_facts").select("id").eq("org_id", viewer.organization!.id)
    .eq("project_id", parsed.data.projectId).eq("code", parsed.data.code).eq("active", true).maybeSingle();
  if (current) {
    const { error: conflictError } = await supabase.from("project_fact_conflicts").insert({
      org_id: viewer.organization!.id, project_id: parsed.data.projectId, code: parsed.data.code,
      current_fact_id: current.id, proposed_value_text: parsed.data.valueText, proposed_unit: parsed.data.unit ?? null,
      proposed_source_name: parsed.data.sourceName, proposed_reference_date: parsed.data.referenceDate,
      proposed_valid_until: parsed.data.validUntil ?? null, created_by: viewer.userId,
    });
    if (conflictError) redirect(`/app/conhecimento?erro=${encodeURIComponent("Já existe um conflito pendente para esse fato.")}`);
    revalidatePath("/app/conhecimento"); redirect("/app/conhecimento?sucesso=conflito-pendente");
  }
  const { error } = await supabase.from("project_facts").insert({ org_id: viewer.organization!.id, project_id: parsed.data.projectId,
    code: parsed.data.code, value_text: parsed.data.valueText, unit: parsed.data.unit ?? null, source_name: parsed.data.sourceName,
    reference_date: parsed.data.referenceDate, valid_until: parsed.data.validUntil ?? null, confidence: 1, active: true });
  if (error) redirect(`/app/conhecimento?erro=${encodeURIComponent("Não foi possível salvar o fato aprovado.")}`);
  revalidatePath("/app/conhecimento"); redirect("/app/conhecimento?sucesso=fato-criado");
}

export async function resolveProjectFactConflictAction(formData: FormData) {
  const parsed = z.object({ conflictId: z.string().uuid(), decision: z.enum(["accept_new", "keep_current", "quarantine_current"]), reason: z.string().trim().min(5).max(1000) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/app/conhecimento?erro=${encodeURIComponent("Escolha a decisão e justifique.")}`);
  const viewer = await requireActiveViewer(); const supabase = await createClient();
  const { error } = await supabase.from("project_fact_conflict_resolution_requests").insert({ org_id: viewer.organization!.id, conflict_id: parsed.data.conflictId, decision: parsed.data.decision, reason: parsed.data.reason, actor_user_id: viewer.userId });
  if (error) redirect(`/app/conhecimento?erro=${encodeURIComponent("Não foi possível resolver o conflito.")}`);
  revalidatePath("/app/conhecimento"); redirect("/app/conhecimento?sucesso=conflito-resolvido");
}
