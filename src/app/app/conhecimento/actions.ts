"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireActiveViewer } from "@/lib/auth/session";
import { TYPED_CONFIRMATION_PHRASE } from "@/lib/typed-confirmation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const projectSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do empreendimento.").max(160, "O nome deve ter até 160 caracteres."),
  region: z.string().trim().min(2, "Informe a cidade ou região do empreendimento.").max(160, "A região deve ter até 160 caracteres."),
  neighborhood: z.string().trim().max(160).optional(),
  summary: z.string().trim().min(20, "Escreva um resumo com pelo menos 20 caracteres.").max(4000, "O resumo deve ter até 4.000 caracteres."),
  deliveryType: z.enum(["ready", "under_construction", "launch", "mixed"], { error: "Escolha a situação da entrega." }),
  minPrice: z.number({ error: "Informe o preço mínimo em reais." }).finite().nonnegative("O preço mínimo não pode ser negativo."),
  maxPrice: z.number({ error: "Informe o preço máximo em reais." }).finite().nonnegative("O preço máximo não pode ser negativo."),
  minDownPayment: z.number({ error: "Informe a entrada mínima em reais." }).finite().nonnegative("A entrada mínima não pode ser negativa."),
  sourceName: z.string().trim().min(2, "Informe a origem dos dados comerciais.").max(160, "A fonte deve ter até 160 caracteres."),
  validUntil: z.string().refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Informe até quando esses dados são válidos."),
});

function parseBrlCurrency(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return Number.NaN;
  const compact = value.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  const normalized = compact.includes(",")
    ? compact.replace(/\./g, "").replace(",", ".")
    : compact;
  const parsed = Number(normalized.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function projectInputFromFormData(formData: FormData) {
  return {
    name: formData.get("name"),
    region: formData.get("region"),
    neighborhood: formData.get("neighborhood") || undefined,
    summary: formData.get("summary"),
    deliveryType: formData.get("deliveryType"),
    minPrice: parseBrlCurrency(formData.get("minPrice")),
    maxPrice: parseBrlCurrency(formData.get("maxPrice")),
    minDownPayment: parseBrlCurrency(formData.get("minDownPayment")),
    sourceName: formData.get("sourceName"),
    validUntil: formData.get("validUntil"),
  };
}

export async function createProjectAction(formData: FormData) {
  const parsed = projectSchema.safeParse(projectInputFromFormData(formData));
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
    cover_storage_path: null,
    status: "draft",
    recommendable: false,
    created_by: viewer.userId,
  });
  if (error) redirect(`/app/conhecimento?erro=${encodeURIComponent("Não foi possível salvar o empreendimento.")}`);
  revalidatePath("/app/conhecimento");
  redirect("/app/conhecimento?sucesso=empreendimento-criado-em-rascunho");
}

export async function updateProjectAction(formData: FormData) {
  const parsed = projectSchema.extend({ projectId: z.string().uuid() }).safeParse({
    ...projectInputFromFormData(formData),
    projectId: formData.get("projectId"),
  });
  if (!parsed.success) {
    redirect(`/app/conhecimento?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Revise os campos.")}`);
  }
  if (parsed.data.maxPrice < parsed.data.minPrice) {
    redirect(`/app/conhecimento?erro=${encodeURIComponent("Preço máximo deve ser maior que o mínimo.")}`);
  }

  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("id,status")
    .eq("id", parsed.data.projectId).eq("org_id", viewer.organization!.id).maybeSingle();
  if (!project) {
    redirect(`/app/conhecimento?erro=${encodeURIComponent("Empreendimento não encontrado.")}`);
  }
  if (project.status === "active" && parsed.data.validUntil < new Date().toISOString().slice(0, 10)) {
    redirect(`/app/conhecimento?erro=${encodeURIComponent("Um empreendimento ativo não pode ficar com os dados comerciais vencidos.")}`);
  }

  const { error } = await supabase.from("projects").update({
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
  }).eq("id", project.id).eq("org_id", viewer.organization!.id);
  if (error) {
    redirect(`/app/conhecimento?erro=${encodeURIComponent("Não foi possível atualizar o empreendimento.")}`);
  }
  revalidatePath("/app/conhecimento");
  redirect("/app/conhecimento?sucesso=empreendimento-atualizado");
}

export async function deleteProjectAction(formData: FormData) {
  const parsed = z.object({
    projectId: z.string().uuid(),
    confirmation: z.literal(TYPED_CONFIRMATION_PHRASE),
  }).safeParse({ projectId: formData.get("projectId"), confirmation: formData.get("confirmation") });
  if (!parsed.success) {
    redirect(`/app/conhecimento?erro=${encodeURIComponent("Confirme a exclusão do empreendimento.")}`);
  }

  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const admin = createAdminClient();
  const [{ data: project }, { data: media }, { data: uploads }] = await Promise.all([
    admin.from("projects").select("id").eq("id", parsed.data.projectId).eq("org_id", viewer.organization!.id).maybeSingle(),
    admin.from("project_media").select("storage_path").eq("project_id", parsed.data.projectId).eq("org_id", viewer.organization!.id),
    admin.from("project_media_uploads").select("storage_path").eq("project_id", parsed.data.projectId).eq("org_id", viewer.organization!.id),
  ]);
  if (!project) {
    redirect(`/app/conhecimento?erro=${encodeURIComponent("Empreendimento não encontrado.")}`);
  }

  const { error } = await supabase.from("projects").delete()
    .eq("id", project.id).eq("org_id", viewer.organization!.id);
  if (error) {
    const message = error.code === "23503"
      ? "Este empreendimento já faz parte do histórico de atendimentos e não pode ser excluído. Pause-o para impedir novas recomendações."
      : "Não foi possível excluir o empreendimento.";
    redirect(`/app/conhecimento?erro=${encodeURIComponent(message)}`);
  }

  const storagePaths = [...new Set([...(media ?? []), ...(uploads ?? [])]
    .map((item) => item.storage_path).filter((path): path is string => Boolean(path)))];
  const { error: storageError } = storagePaths.length
    ? await admin.storage.from("gril-projects").remove(storagePaths)
    : { error: null };
  revalidatePath("/app/conhecimento");
  redirect(`/app/conhecimento?sucesso=${storageError ? "empreendimento-excluido-limpeza-pendente" : "empreendimento-excluido"}`);
}

export async function changeProjectRecommendationAction(formData: FormData) {
  const parsed = z.object({
    projectId: z.string().uuid(),
    action: z.enum(["activate", "pause"]),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/app/conhecimento?erro=${encodeURIComponent("Empreendimento ou ação inválida.")}`);

  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("id,valid_until")
    .eq("id", parsed.data.projectId).eq("org_id", viewer.organization!.id).maybeSingle();
  if (!project) redirect(`/app/conhecimento?erro=${encodeURIComponent("Empreendimento não encontrado.")}`);

  if (parsed.data.action === "activate") {
    if (project.valid_until && project.valid_until < new Date().toISOString().slice(0, 10)) {
      redirect(`/app/conhecimento?erro=${encodeURIComponent("Atualize a validade dos dados comerciais antes de ativar.")}`);
    }
    const { data: cover } = await supabase.from("project_media").select("storage_path")
      .eq("project_id", project.id).eq("org_id", viewer.organization!.id).eq("media_type", "cover").eq("active", true).maybeSingle();
    if (!cover?.storage_path) {
      redirect(`/app/conhecimento?erro=${encodeURIComponent("Adicione uma foto principal antes de ativar o empreendimento.")}`);
    }
    const { error } = await supabase.from("projects").update({
      cover_storage_path: cover.storage_path,
      status: "active",
      recommendable: true,
    }).eq("id", project.id).eq("org_id", viewer.organization!.id);
    if (error) redirect(`/app/conhecimento?erro=${encodeURIComponent("Não foi possível ativar o empreendimento.")}`);
    revalidatePath("/app/conhecimento");
    redirect("/app/conhecimento?sucesso=empreendimento-ativado");
  }

  const { error } = await supabase.from("projects").update({ status: "draft", recommendable: false })
    .eq("id", project.id).eq("org_id", viewer.organization!.id);
  if (error) redirect(`/app/conhecimento?erro=${encodeURIComponent("Não foi possível pausar as recomendações.")}`);
  revalidatePath("/app/conhecimento");
  redirect("/app/conhecimento?sucesso=empreendimento-pausado");
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
