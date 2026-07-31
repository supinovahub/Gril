"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireActiveViewer } from "@/lib/auth/session";
import { validateOpenAiCredential } from "@/lib/integrations/openai";
import { IntegrationProviderError } from "@/lib/integrations/provider-http";
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
  const { error } = await supabase.from("persona_publish_requests").insert({
    org_id: viewer.organization!.id,
    persona_version_id: versionId.data,
    actor_user_id: viewer.userId,
  });
  if (error) return;
  revalidatePath("/app/pedro");
  redirect("/app/pedro?sucesso=persona-publicada");
}

export async function changeGlobalAiModeAction(formData: FormData) {
  const mode = z.enum(["off", "shadow", "assisted", "production"]).safeParse(formData.get("mode"));
  if (!mode.success) return;
  const viewer = await requireActiveViewer();
  if (viewer.membership?.role !== "owner") return;
  const supabase = await createClient();

  if (mode.data === "production") {
    const [{ count: modelCount }, { count: connectionCount }] = await Promise.all([
      supabase.from("model_profiles").select("id", { count: "exact", head: true }).eq("org_id", viewer.organization!.id).eq("status", "active").eq("is_default", true),
      supabase.from("whatsapp_connections").select("id", { count: "exact", head: true }).eq("org_id", viewer.organization!.id).eq("status", "active").eq("inbound_enabled", true),
    ]);
    if (!modelCount || !connectionCount) {
      redirect(`/app/pedro?erro=${encodeURIComponent("Produção exige modelo ativo e ao menos um WhatsApp inbound ativo.")}`);
    }
  }

  const { error } = await supabase.from("organization_settings").update({ ai_global_mode: mode.data }).eq("org_id", viewer.organization!.id);
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
