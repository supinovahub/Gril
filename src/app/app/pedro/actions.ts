"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireActiveViewer } from "@/lib/auth/session";
import type { Json } from "@/lib/database.types";
import { validateOpenAiCredential } from "@/lib/integrations/openai";
import { IntegrationProviderError } from "@/lib/integrations/provider-http";
import { analyzePersonaSample, maskPersonaSample } from "@/lib/integrations/persona-analysis";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  profileId: z.string().uuid(),
  reasoningEffort: z.enum(["none", "low", "medium", "high", "xhigh", "max"]),
  textVerbosity: z.enum(["low", "medium", "high"]),
});

export async function connectOpenAiAction(formData: FormData) {
  const parsed = z
    .object({ apiKey: z.string().trim().min(20).max(4000) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/app/pedro?erro=${encodeURIComponent("Informe a chave completa da OpenAI.")}`);
  }

  const viewer = await requireActiveViewer();
  if (viewer.membership?.role !== "owner") {
    redirect(`/app/pedro?erro=${encodeURIComponent("Somente o dono pode conectar a chave da OpenAI.")}`);
  }

  try {
    const verified = await validateOpenAiCredential(parsed.data.apiKey);
    const admin = createAdminClient();
    const { error } = await admin.rpc("store_openai_integration", {
      p_actor_user_id: viewer.userId,
      p_credential_hint: verified.credentialHint,
      p_latency_ms: verified.latencyMs,
      p_model_count: verified.modelIds.length,
      p_org_id: viewer.organization!.id,
      p_secret: verified.apiKey,
    });
    if (error) throw error;
  } catch (error) {
    const message =
      error instanceof IntegrationProviderError
        ? error.userMessage
        : "Não foi possível salvar a chave da OpenAI.";
    redirect(`/app/pedro?erro=${encodeURIComponent(message)}`);
  }

  revalidatePath("/app/pedro");
  redirect(`/app/pedro?sucesso=${encodeURIComponent("Chave da OpenAI validada e armazenada no Vault.")}`);
}

export async function configureModelAction(formData: FormData) {
  const parsed = profileSchema.safeParse({
    profileId: formData.get("profileId"),
    reasoningEffort: formData.get("reasoningEffort"),
    textVerbosity: formData.get("textVerbosity"),
  });
  if (!parsed.success) return;

  const viewer = await requireActiveViewer();
  if (viewer.membership?.role !== "owner") return;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("model_profiles")
    .select("id,org_id,status,secret_reference,integration_account_id")
    .eq("id", parsed.data.profileId)
    .eq("org_id", viewer.organization!.id)
    .maybeSingle();
  if (!profile || profile.status !== "draft") return;
  if (!profile.secret_reference || !profile.integration_account_id) {
    redirect(`/app/pedro?erro=${encodeURIComponent("Conecte primeiro a chave da OpenAI.")}`);
  }

  const { error } = await supabase
    .from("model_profiles")
    .update({
      reasoning_effort: parsed.data.reasoningEffort,
      text_verbosity: parsed.data.textVerbosity,
    })
    .eq("id", profile.id)
    .eq("status", "draft");
  if (error) return;

  if (formData.get("activate") === "on") {
    const { error: activationError } = await supabase
      .from("model_activation_requests")
      .insert({
        org_id: viewer.organization!.id,
        model_profile_id: profile.id,
        actor_user_id: viewer.userId,
      });
    if (activationError) {
      redirect(`/app/pedro?erro=${encodeURIComponent("A referência foi salva, mas a ativação falhou.")}`);
    }
  }

  revalidatePath("/app/pedro");
  redirect("/app/pedro?sucesso=modelo-configurado");
}

export async function createPersonaDraftAction(formData: FormData) {
  const personaId = z.string().uuid().safeParse(formData.get("personaId"));
  const prompt = z.string().trim().min(100).max(30000).safeParse(formData.get("compiledPrompt"));
  if (!personaId.success || !prompt.success) return;

  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { data: published } = await supabase
    .from("persona_versions")
    .select("*")
    .eq("persona_id", personaId.data)
    .eq("org_id", viewer.organization!.id)
    .eq("status", "published")
    .maybeSingle();
  if (!published) return;

  const { data: latest } = await supabase
    .from("persona_versions")
    .select("version")
    .eq("persona_id", personaId.data)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const checksum = createHash("sha256").update(prompt.data).digest("hex");
  const { error } = await supabase.from("persona_versions").insert({
    org_id: viewer.organization!.id,
    persona_id: personaId.data,
    version: (latest?.version ?? 0) + 1,
    status: "draft",
    identity: published.identity,
    style: published.style,
    boundaries: published.boundaries,
    escalation_rules: published.escalation_rules,
    examples: published.examples,
    compiled_prompt: prompt.data,
    checksum,
    source_version_id: published.id,
    created_by: viewer.userId,
  });
  if (error) return;
  revalidatePath("/app/pedro");
  redirect("/app/pedro?sucesso=rascunho-criado");
}

export async function publishPersonaAction(formData: FormData) {
  const versionId = z.string().uuid().safeParse(formData.get("personaVersionId"));
  if (!versionId.success) return;
  const viewer = await requireActiveViewer();
  if (viewer.membership?.role !== "owner") return;
  const supabase = await createClient();
  const { data: version } = await supabase
    .from("persona_versions")
    .select("persona_id")
    .eq("id", versionId.data)
    .eq("org_id", viewer.organization!.id)
    .maybeSingle();
  if (!version) return;
  const [{ count: sampleCount }, { count: anySamples }] = await Promise.all([
    supabase.from("persona_samples").select("id", { count: "exact", head: true }).eq("persona_id", version.persona_id).eq("status", "confirmed"),
    supabase.from("persona_samples").select("id", { count: "exact", head: true }).eq("persona_id", version.persona_id).neq("status", "purged"),
  ]);
  if ((anySamples ?? 0) > 0 && (sampleCount ?? 0) < 10) {
    redirect(`/app/pedro?erro=${encodeURIComponent("Confirme pelo menos 10 amostras antes de publicar essa persona.")}`);
  }
  const { error } = await supabase.from("persona_publish_requests").insert({
    org_id: viewer.organization!.id,
    persona_version_id: versionId.data,
    actor_user_id: viewer.userId,
  });
  if (error) return;
  revalidatePath("/app/pedro");
  redirect("/app/pedro?sucesso=persona-publicada");
}

export async function addPersonaSampleAction(formData: FormData) {
  const parsed = z.object({ personaId: z.string().uuid(), sample: z.string().trim().min(10).max(20000) }).safeParse({ personaId: formData.get("personaId"), sample: formData.get("sample") });
  if (!parsed.success) redirect(`/app/pedro?erro=${encodeURIComponent("A amostra deve ter entre 10 e 20.000 caracteres.")}`);
  const viewer = await requireActiveViewer(); const supabase = await createClient();
  const { count } = await supabase.from("persona_samples").select("id", { count: "exact", head: true }).eq("persona_id", parsed.data.personaId).neq("status", "purged");
  if ((count ?? 0) >= 30) redirect(`/app/pedro?erro=${encodeURIComponent("O limite é de 30 amostras por persona.")}`);
  const maskedText = maskPersonaSample(parsed.data.sample);
  let extraction: Json = {};
  try {
    const admin = createAdminClient();
    const { data: model } = await admin.from("model_profiles").select("model_identifier,integration_account_id").eq("org_id", viewer.organization!.id).eq("status", "active").eq("is_default", true).maybeSingle();
    if (model?.integration_account_id) {
      const { data: apiKey } = await admin.rpc("get_integration_secret", { p_integration_account_id: model.integration_account_id });
      if (apiKey) extraction = await analyzePersonaSample({ apiKey, model: model.model_identifier, maskedText });
    }
  } catch { extraction = { pending_manual_review: true }; }
  const { error } = await supabase.from("persona_samples").insert({ org_id: viewer.organization!.id, persona_id: parsed.data.personaId, raw_text: parsed.data.sample, masked_text: maskedText, extraction, status: "confirmed", created_by: viewer.userId });
  if (error) redirect(`/app/pedro?erro=${encodeURIComponent("Não foi possível salvar a amostra.")}`);
  revalidatePath("/app/pedro"); redirect("/app/pedro?sucesso=amostra-analisada");
}

export async function clonePersonaAction(formData: FormData) {
  const parsed = z.object({ sourcePersonaId: z.string().uuid(), name: z.string().trim().min(2).max(120), code: z.string().trim().regex(/^[a-z0-9_]+$/) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/app/pedro?erro=${encodeURIComponent("Informe nome e código válido para a persona.")}`);
  const viewer = await requireActiveViewer(); const supabase = await createClient();
  const { data: source } = await supabase.from("persona_versions").select("*").eq("persona_id", parsed.data.sourcePersonaId).eq("status", "published").maybeSingle();
  if (!source) redirect(`/app/pedro?erro=${encodeURIComponent("A persona de origem não possui versão publicada.")}`);
  const { data: persona, error } = await supabase.from("personas").insert({ org_id: viewer.organization!.id, code: parsed.data.code, name: parsed.data.name, identity_name: parsed.data.name, created_by: viewer.userId }).select("id").single();
  if (error) redirect(`/app/pedro?erro=${encodeURIComponent("Nome ou código já utilizado.")}`);
  await supabase.from("persona_versions").insert({ org_id: viewer.organization!.id, persona_id: persona.id, version: 1, status: "draft", identity: source.identity, style: source.style, boundaries: source.boundaries, escalation_rules: source.escalation_rules, examples: source.examples, compiled_prompt: source.compiled_prompt, checksum: source.checksum, source_version_id: source.id, created_by: viewer.userId });
  revalidatePath("/app/pedro"); redirect("/app/pedro?sucesso=persona-clonada");
}

export async function changeGlobalAiModeAction(formData: FormData) {
  const mode = z.enum(["off", "shadow", "assisted", "production"]).safeParse(formData.get("mode"));
  if (!mode.success) return;
  const viewer = await requireActiveViewer();
  if (viewer.membership?.role !== "owner") return;
  const supabase = await createClient();

  const { error } = await supabase.from("organization_settings").update({ ai_global_mode: mode.data, inbound_ai_mode: mode.data }).eq("org_id", viewer.organization!.id);
  if (error) {
    const reason = error.message.includes("institutional") ? "Complete a identidade institucional."
      : error.message.includes("knowledge_or_rules") ? "Publique persona, regras, qualificação e ao menos um empreendimento válido."
      : error.message.includes("models") ? "Configure modelo principal e fallback aprovado."
      : error.message.includes("channel_unhealthy") ? "Teste um WhatsApp inbound ativo e saudável nos últimos 15 minutos."
      : error.message.includes("regression") ? "Execute os 100 casos reais: mínimo de 90% geral e nenhum erro crítico."
      : "O banco recusou a mudança de modo por um gate de segurança.";
    redirect(`/app/pedro?erro=${encodeURIComponent(reason)}`);
  }
  revalidatePath("/app/pedro");
}

export async function configureReactivationAiAction(formData: FormData) {
  const parsed = z.object({
    mode: z.enum(["off", "shadow", "assisted", "production"]),
    releaseState: z.enum(["blocked", "test_controlled", "released"]),
    autonomy: z.enum(["low", "medium", "high"]),
  }).safeParse({
    mode: formData.get("reactivationMode"),
    releaseState: formData.get("releaseState"),
    autonomy: formData.get("reactivationAutonomy"),
  });
  if (!parsed.success) return;
  const viewer = await requireActiveViewer();
  if (viewer.membership?.role !== "owner") return;
  const supabase = await createClient();
  if (parsed.data.mode === "production" && parsed.data.releaseState === "blocked") {
    redirect(`/app/pedro?erro=${encodeURIComponent("Produção de reativação precisa estar em teste controlado ou liberada.")}`);
  }
  const { error } = await supabase.from("organization_settings").update({
    reactivation_ai_mode: parsed.data.mode,
    reactivation_release_state: parsed.data.releaseState,
    reactivation_autonomy: parsed.data.autonomy,
  }).eq("org_id", viewer.organization!.id);
  if (error) redirect(`/app/pedro?erro=${encodeURIComponent("Não foi possível salvar o modo de reativação.")}`);
  revalidatePath("/app/pedro");
}

export async function addAiTestNumberAction(formData: FormData) {
  const phone = z.string().trim().regex(/^\+[1-9][0-9]{7,14}$/).safeParse(formData.get("phoneE164"));
  if (!phone.success) redirect(`/app/pedro?erro=${encodeURIComponent("Informe o telefone no formato E.164, como +5511999999999.")}`);
  const viewer = await requireActiveViewer();
  if (!viewer.membership || !["owner", "manager"].includes(viewer.membership.role)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("ai_test_allowlist").upsert({
    org_id: viewer.organization!.id,
    operation_id: null,
    phone_e164: phone.data,
    active: true,
    created_by: viewer.userId,
  }, { onConflict: "org_id,phone_e164" });
  if (error) redirect(`/app/pedro?erro=${encodeURIComponent("Não foi possível liberar o número de teste.")}`);
  revalidatePath("/app/pedro");
}

export async function removeAiTestNumberAction(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("allowlistId"));
  if (!id.success) return;
  const viewer = await requireActiveViewer();
  if (!viewer.membership || !["owner", "manager"].includes(viewer.membership.role)) return;
  const supabase = await createClient();
  await supabase.from("ai_test_allowlist").update({ active: false }).eq("id", id.data).eq("org_id", viewer.organization!.id);
  revalidatePath("/app/pedro");
}

export async function configureFallbackModelAction(formData: FormData) {
  const profileId = z.string().uuid().safeParse(formData.get("fallbackModelProfileId"));
  if (!profileId.success) redirect(`/app/pedro?erro=${encodeURIComponent("Selecione um modelo secundário aprovado.")}`);
  const viewer = await requireActiveViewer();
  if (viewer.membership?.role !== "owner") return;
  const supabase = await createClient();
  const { data: profile } = await supabase.from("model_profiles")
    .select("id,integration_account_id,secret_reference,is_default")
    .eq("id", profileId.data).eq("org_id", viewer.organization!.id).maybeSingle();
  if (!profile?.integration_account_id || !profile.secret_reference || profile.is_default) {
    redirect(`/app/pedro?erro=${encodeURIComponent("O fallback deve ser diferente do principal e possuir chave validada.")}`);
  }
  const { error } = await supabase.from("organization_settings")
    .update({ fallback_model_profile_id: profile.id }).eq("org_id", viewer.organization!.id);
  if (error) redirect(`/app/pedro?erro=${encodeURIComponent("Não foi possível salvar o fallback.")}`);
  revalidatePath("/app/pedro");
  redirect("/app/pedro?sucesso=fallback-configurado");
}
