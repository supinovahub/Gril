"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const scopeSchema = z.enum(["style", "rule", "faq", "qualification", "scheduling", "escalation"]);

function canManageAi(viewer: Awaited<ReturnType<typeof requireActiveViewer>>) {
  return viewer.membership?.role === "owner"
    || viewer.membership?.role === "manager"
    || viewer.permissions.includes("ai.manage");
}

function optionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function createLearningAction(formData: FormData) {
  const parsed = z.object({
    observation: z.string().trim().min(5).max(4000),
    suggestedChange: z.string().trim().min(5).max(4000),
    observedResponse: z.string().trim().max(4000).optional(),
    scope: scopeSchema,
    targetSkillModuleId: z.string().uuid().optional(),
  }).safeParse({
    observation: formData.get("observation"),
    suggestedChange: formData.get("suggestedChange"),
    observedResponse: optionalString(formData, "observedResponse"),
    scope: formData.get("scope"),
    targetSkillModuleId: optionalString(formData, "targetSkillModuleId"),
  });
  if (!parsed.success) redirect("/app/aprendizados?erro=revise-os-campos");

  const viewer = await requireActiveViewer();
  if (!canManageAi(viewer)) redirect("/app?erro=sem-permissao");
  const supabase = await createClient();
  if (parsed.data.targetSkillModuleId) {
    const { data: target } = await supabase.from("ai_skill_modules")
      .select("id")
      .eq("id", parsed.data.targetSkillModuleId)
      .eq("org_id", viewer.organization!.id)
      .eq("status", "active")
      .maybeSingle();
    if (!target) redirect("/app/aprendizados?erro=skill-invalida");
  }
  const operation = viewer.operations.find((item) => item.is_default) ?? viewer.operations[0];
  const { error } = await supabase.from("learning_suggestions").insert({
    org_id: viewer.organization!.id,
    operation_id: operation?.id ?? null,
    source: "manual",
    observed_response: parsed.data.observedResponse ?? null,
    human_observation: parsed.data.observation,
    suggested_change: parsed.data.suggestedChange,
    scope: parsed.data.scope,
    target_skill_module_id: parsed.data.targetSkillModuleId ?? null,
    created_by: viewer.userId,
  });
  if (error) redirect("/app/aprendizados?erro=nao-foi-possivel-criar");
  revalidatePath("/app/aprendizados");
  redirect("/app/aprendizados?sucesso=sugestao-criada");
}

export async function reviewLearningAction(formData: FormData) {
  const parsed = z.object({
    suggestionId: z.string().uuid(),
    decision: z.enum(["approve_draft", "approve_case", "reject", "mark_conflict"]),
    reason: z.string().trim().max(1000).optional(),
    targetSkillModuleId: z.string().uuid().optional(),
    skillCode: z.string().trim().regex(/^[a-z0-9_]{3,80}$/).optional(),
    skillName: z.string().trim().min(3).max(120).optional(),
    triggerDescription: z.string().trim().min(3).max(1000).optional(),
    finalInstructions: z.string().trim().min(5).max(8000).optional(),
  }).safeParse({
    suggestionId: formData.get("suggestionId"),
    decision: formData.get("decision"),
    reason: optionalString(formData, "reason"),
    targetSkillModuleId: optionalString(formData, "targetSkillModuleId"),
    skillCode: optionalString(formData, "skillCode"),
    skillName: optionalString(formData, "skillName"),
    triggerDescription: optionalString(formData, "triggerDescription"),
    finalInstructions: optionalString(formData, "finalInstructions"),
  });
  if (!parsed.success) redirect("/app/aprendizados?erro=decisao-invalida");

  const viewer = await requireActiveViewer();
  if (!canManageAi(viewer)) redirect("/app?erro=sem-permissao");
  const supabase = await createClient();
  const { data: suggestion } = await supabase.from("learning_suggestions")
    .select("id,status")
    .eq("id", parsed.data.suggestionId)
    .eq("org_id", viewer.organization!.id)
    .maybeSingle();
  if (!suggestion || !["new", "reviewing", "conflict"].includes(suggestion.status)) {
    redirect("/app/aprendizados?erro=sugestao-ja-revisada-ou-conflitante");
  }
  if (parsed.data.targetSkillModuleId) {
    const { data: target } = await supabase.from("ai_skill_modules")
      .select("id")
      .eq("id", parsed.data.targetSkillModuleId)
      .eq("org_id", viewer.organization!.id)
      .eq("status", "active")
      .maybeSingle();
    if (!target) redirect("/app/aprendizados?erro=skill-invalida");
  }
  const { error } = await supabase.from("learning_review_requests").insert({
    org_id: viewer.organization!.id,
    learning_suggestion_id: parsed.data.suggestionId,
    decision: parsed.data.decision,
    reason: parsed.data.reason ?? null,
    actor_user_id: viewer.userId,
    target_skill_module_id: parsed.data.targetSkillModuleId ?? null,
    skill_code: parsed.data.skillCode ?? null,
    skill_name: parsed.data.skillName ?? null,
    trigger_description: parsed.data.triggerDescription ?? null,
    final_instructions: parsed.data.finalInstructions ?? null,
  });
  if (error) redirect("/app/aprendizados?erro=sugestao-ja-revisada-ou-conflitante");
  revalidatePath("/app/aprendizados");
  revalidatePath("/app/pedro");
  const successByDecision = {
    approve_draft: "rascunho-e-regressao-criados",
    approve_case: "cenario-adicionado-aos-testes",
    mark_conflict: "conflito-registrado",
    reject: "sugestao-descartada",
  } as const;
  redirect(`/app/aprendizados?sucesso=${successByDecision[parsed.data.decision]}`);
}

export async function requestMetaReviewAction() {
  const viewer = await requireActiveViewer();
  if (!canManageAi(viewer)) redirect("/app?erro=sem-permissao");
  const supabase = await createClient();
  const { error } = await supabase.from("ai_meta_review_requests").insert({
    org_id: viewer.organization!.id,
    actor_user_id: viewer.userId,
  });
  if (error) redirect("/app/aprendizados?erro=sem-sinais-ou-revisao-em-andamento");
  revalidatePath("/app/aprendizados");
  redirect("/app/aprendizados?sucesso=revisao-enfileirada");
}

export async function publishRuleVersionAction(formData: FormData) {
  const versionId = z.string().uuid().safeParse(formData.get("ruleVersionId"));
  if (!versionId.success) redirect("/app/aprendizados?erro=versao-invalida");
  const viewer = await requireActiveViewer();
  if (viewer.membership?.role !== "owner") redirect("/app/aprendizados?erro=publicacao-exige-dono");
  const supabase = await createClient();
  const { data: version } = await supabase.from("rule_versions")
    .select("id,status")
    .eq("id", versionId.data)
    .eq("org_id", viewer.organization!.id)
    .eq("status", "draft")
    .maybeSingle();
  if (!version) redirect("/app/aprendizados?erro=versao-invalida");
  const { error } = await supabase.from("rule_publish_requests").insert({
    org_id: viewer.organization!.id,
    rule_version_id: version.id,
    actor_user_id: viewer.userId,
  });
  if (error) redirect("/app/aprendizados?erro=regressao-ainda-nao-aprovada");
  revalidatePath("/app/aprendizados");
  revalidatePath("/app/pedro");
  redirect("/app/aprendizados?sucesso=skill-publicada");
}
