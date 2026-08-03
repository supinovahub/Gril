"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireActiveViewer } from "@/lib/auth/session";
import type { Json } from "@/lib/database.types";
import { IntegrationProviderError } from "@/lib/integrations/provider-http";
import { listMetaTemplates, validateMetaCredential } from "@/lib/integrations/meta";
import { configureUazapiWebhook, createUazapiInstance, requestUazapiPairing, validateUazapiCredential } from "@/lib/integrations/uazapi";
import { parseMetaSecret } from "@/lib/integrations/whatsapp-runtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const baseConnectionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  operationId: z.string().uuid(),
});

const uazapiSchema = baseConnectionSchema.extend({
  baseUrl: z.string().trim().url(),
  token: z.string().trim().min(8).max(2000),
});

const metaSchema = baseConnectionSchema.extend({
  wabaId: z.string().trim().min(5).max(40),
  phoneNumberId: z.string().trim().min(5).max(40),
  accessToken: z.string().trim().min(20).max(4000),
  appSecret: z.string().trim().min(8).max(1000),
});

function integrationError(error: unknown) {
  return error instanceof IntegrationProviderError
    ? error.userMessage
    : "Não foi possível salvar a integração. Tente novamente.";
}

function whatsappFeedback(kind: "erro" | "sucesso", message: string) {
  return `/app/configuracoes/whatsapp?${kind}=${encodeURIComponent(message)}`;
}

export async function connectUazapiAction(formData: FormData) {
  const parsed = uazapiSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(whatsappFeedback("erro", "Revise os dados da instância Uazapi."));
  }

  const viewer = await requireActiveViewer();
  if (viewer.membership?.role !== "owner") {
    redirect(whatsappFeedback("erro", "Somente o dono pode conectar credenciais."));
  }
  const operation = viewer.operations.find((item) => item.id === parsed.data.operationId);
  if (!operation) {
    redirect(whatsappFeedback("erro", "A operação selecionada não está disponível."));
  }

  try {
    const verified = await validateUazapiCredential({
      baseUrl: parsed.data.baseUrl,
      token: parsed.data.token,
    });
    const admin = createAdminClient();
    const { error } = await admin.rpc("store_whatsapp_integration", {
      p_actor_user_id: viewer.userId,
      p_base_url: verified.baseUrl,
      p_credential_hint: verified.credentialHint,
      p_external_account_id: verified.externalAccountId,
      p_external_business_id: "",
      p_external_phone_number_id: "",
      p_label: parsed.data.name,
      p_latency_ms: verified.latencyMs,
      p_metadata: verified.metadata as Json,
      p_operation_id: operation.id,
      p_org_id: viewer.organization!.id,
      p_phone_e164: verified.phoneE164,
      p_provider: "uazapi",
      p_secret: verified.token,
      p_visible_profile_name: verified.visibleProfileName,
    });
    if (error) throw error;
  } catch (error) {
    redirect(whatsappFeedback("erro", integrationError(error)));
  }

  revalidatePath("/app/configuracoes/whatsapp");
  redirect(whatsappFeedback("sucesso", "Uazapi validada e conectada com segurança."));
}

export async function connectMetaAction(formData: FormData) {
  const parsed = metaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(whatsappFeedback("erro", "Revise os IDs e as credenciais da Meta."));
  }

  const viewer = await requireActiveViewer();
  if (viewer.membership?.role !== "owner") {
    redirect(whatsappFeedback("erro", "Somente o dono pode conectar credenciais."));
  }
  const operation = viewer.operations.find((item) => item.id === parsed.data.operationId);
  if (!operation) {
    redirect(whatsappFeedback("erro", "A operação selecionada não está disponível."));
  }

  try {
    const verified = await validateMetaCredential(parsed.data);
    const admin = createAdminClient();
    const { error } = await admin.rpc("store_whatsapp_integration", {
      p_actor_user_id: viewer.userId,
      p_base_url: verified.baseUrl,
      p_credential_hint: verified.credentialHint,
      p_external_account_id: verified.externalAccountId,
      p_external_business_id: verified.externalBusinessId,
      p_external_phone_number_id: verified.externalPhoneNumberId,
      p_label: parsed.data.name,
      p_latency_ms: verified.latencyMs,
      p_metadata: verified.metadata as Json,
      p_operation_id: operation.id,
      p_org_id: viewer.organization!.id,
      p_phone_e164: verified.phoneE164,
      p_provider: "meta_cloud",
      p_secret: verified.secret,
      p_visible_profile_name: verified.visibleProfileName,
    });
    if (error) throw error;
  } catch (error) {
    redirect(whatsappFeedback("erro", integrationError(error)));
  }

  revalidatePath("/app/configuracoes/whatsapp");
  redirect(whatsappFeedback("sucesso", "Conta oficial da Meta validada e conectada."));
}

export async function changeConnectionStateAction(formData: FormData) {
  const parsed = z
    .object({
      connectionId: z.string().uuid(),
      action: z.enum(["activate", "pause"]),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(whatsappFeedback("erro", "Ação inválida."));
  }
  const viewer = await requireActiveViewer();
  if (viewer.membership?.role !== "owner") {
    redirect(whatsappFeedback("erro", "Ação exclusiva do dono."));
  }
  const campaignEnabled = formData.get("campaignEnabled") === "on";
  const inboundRequested = formData.get("inboundEnabled") === "on";
  const inboundEnabled = parsed.data.action === "activate" && !inboundRequested && !campaignEnabled
    ? true
    : inboundRequested;
  const supabase = await createClient();
  const { error } = await supabase.from("connection_activation_requests").insert({
    org_id: viewer.organization!.id,
    connection_id: parsed.data.connectionId,
    action: parsed.data.action,
    inbound_enabled: inboundEnabled,
    campaign_enabled: campaignEnabled,
    reason: String(formData.get("reason") ?? "").trim() || null,
    actor_user_id: viewer.userId,
  });
  if (error) {
    redirect(
      whatsappFeedback(
        "erro",
        "A ativação exige credencial verificada e health check saudável nos últimos 15 minutos.",
      ),
    );
  }
  revalidatePath("/app/configuracoes/whatsapp");
  redirect(whatsappFeedback("sucesso", "Estado da conexão atualizado."));
}

export async function syncMetaTemplatesAction(formData: FormData) {
  const connectionId = z.string().uuid().safeParse(formData.get("connectionId"));
  if (!connectionId.success) redirect(whatsappFeedback("erro", "Conexão inválida."));
  const viewer = await requireActiveViewer();
  if (viewer.membership?.role !== "owner") redirect(whatsappFeedback("erro", "Ação exclusiva do dono."));
  const admin = createAdminClient();
  const { data: connection } = await admin.from("whatsapp_connections")
    .select("id,org_id,operation_id,provider,integration_account_id")
    .eq("id", connectionId.data).eq("org_id", viewer.organization!.id).maybeSingle();
  if (!connection?.integration_account_id || connection.provider !== "meta_cloud") redirect(whatsappFeedback("erro", "Conexão Meta não encontrada."));
  const [{ data: account }, { data: secret }] = await Promise.all([
    admin.from("integration_accounts").select("external_business_id").eq("id", connection.integration_account_id).single(),
    admin.rpc("get_integration_secret", { p_integration_account_id: connection.integration_account_id }),
  ]);
  if (!account?.external_business_id || !secret) redirect(whatsappFeedback("erro", "Credencial Meta indisponível."));
  try {
    const credential = parseMetaSecret(secret);
    const templates = await listMetaTemplates({ ...credential, wabaId: account.external_business_id });
    const { error } = await admin.from("whatsapp_message_templates").upsert(templates.map((template) => ({
      org_id: connection.org_id, operation_id: connection.operation_id, connection_id: connection.id,
      external_name: template.name, language: template.language, category: template.category ?? null,
      provider_status: template.status, components: template.components as Json, variable_count: template.variableCount,
      last_synced_at: new Date().toISOString(),
    })), { onConflict: "connection_id,external_name,language" });
    if (error) throw error;
  } catch (error) {
    redirect(whatsappFeedback("erro", integrationError(error)));
  }
  revalidatePath("/app/configuracoes/whatsapp"); revalidatePath("/app/campanhas");
  redirect(whatsappFeedback("sucesso", "Templates Meta sincronizados."));
}

export async function configureMetaTemplateAction(formData: FormData) {
  const parsed = z.object({
    templateId: z.string().uuid(), purpose: z.enum(["campaign","followup","call_reminder","operational","general"]),
    strategy: z.enum(["none","first_name","body","call_datetime","call_link"]).optional(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(whatsappFeedback("erro", "Configuração de template inválida."));
  const viewer = await requireActiveViewer();
  if (viewer.membership?.role !== "owner") redirect(whatsappFeedback("erro", "Ação exclusiva do dono."));
  const admin = createAdminClient();
  const { data: template } = await admin.from("whatsapp_message_templates").select("id,provider_status,variable_count")
    .eq("id", parsed.data.templateId).eq("org_id", viewer.organization!.id).maybeSingle();
  if (!template || template.provider_status !== "APPROVED" || template.variable_count > 1) {
    redirect(whatsappFeedback("erro", "Somente templates aprovados com no máximo uma variável podem ser automatizados."));
  }
  const strategy = template.variable_count === 0 ? "none" : parsed.data.strategy ?? "none";
  if (template.variable_count === 1 && strategy === "none") redirect(whatsappFeedback("erro", "Escolha como preencher a variável do template."));
  const { error } = await admin.from("whatsapp_message_templates").update({
    purpose: parsed.data.purpose, parameter_strategy: strategy, enabled: true, updated_at: new Date().toISOString(),
  }).eq("id", template.id).eq("org_id", viewer.organization!.id);
  if (error) redirect(whatsappFeedback("erro", "Não foi possível habilitar o template."));
  revalidatePath("/app/configuracoes/whatsapp"); revalidatePath("/app/campanhas");
  redirect(whatsappFeedback("sucesso", "Template habilitado para automação."));
}

export async function configureUazapiWebhookAction(formData: FormData) {
  const connectionId = z.string().uuid().safeParse(formData.get("connectionId"));
  if (!connectionId.success) redirect(whatsappFeedback("erro", "Conexão inválida."));
  const viewer = await requireActiveViewer();
  if (viewer.membership?.role !== "owner") redirect(whatsappFeedback("erro", "Ação exclusiva do dono."));
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (!appUrl.startsWith("https://")) redirect(whatsappFeedback("erro", "Configure NEXT_PUBLIC_APP_URL com a URL HTTPS do deploy final."));
  const admin = createAdminClient();
  const { data: connection } = await admin.from("whatsapp_connections").select("id,org_id,provider,status,endpoint_url,integration_account_id,settings")
    .eq("id", connectionId.data).eq("org_id", viewer.organization!.id).maybeSingle();
  if (!connection?.integration_account_id || connection.provider !== "uazapi" || !connection.endpoint_url) redirect(whatsappFeedback("erro", "Conexão Uazapi não encontrada."));
  const { data: token } = await admin.rpc("get_integration_secret", { p_integration_account_id: connection.integration_account_id });
  if (!token) redirect(whatsappFeedback("erro", "Token Uazapi indisponível."));
  const callbackUrl = `${appUrl}/api/webhooks/whatsapp/${connection.id}`;
  try {
    await configureUazapiWebhook({ baseUrl: connection.endpoint_url, token, callbackUrl });
    await admin.from("whatsapp_connections").update({
      ...(connection.status === "active" ? { inbound_enabled: true } : {}),
      settings: {
        ...((connection.settings ?? {}) as Record<string, Json>),
        webhook_configured_at: new Date().toISOString(),
        webhook_callback: callbackUrl,
      },
    }).eq("id", connection.id);
  } catch (error) {
    redirect(whatsappFeedback("erro", integrationError(error)));
  }
  revalidatePath("/app/configuracoes/whatsapp");
  redirect(whatsappFeedback("sucesso", "Webhook Uazapi configurado e recebimento inbound habilitado."));
}

export type UazapiPairingState = { status: "idle" | "error" | "success"; message?: string; pairCode?: string; qrImage?: string };
export type UazapiInstanceState = { status: "idle" | "error" | "success"; message?: string; token?: string; baseUrl?: string };

export async function createUazapiInstanceAction(_previous: UazapiInstanceState, formData: FormData): Promise<UazapiInstanceState> {
  const parsed = z.object({ baseUrl: z.string().url(), adminToken: z.string().min(8), name: z.string().trim().min(2).max(120), systemName: z.string().trim().min(2).max(120) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Revise URL, admintoken e nomes da instância." };
  const viewer = await requireActiveViewer();
  if (viewer.membership?.role !== "owner") return { status: "error", message: "Ação exclusiva do dono." };
  try {
    const created = await createUazapiInstance(parsed.data);
    return { status: "success", message: "Instância criada. Copie o token uma vez e gere o QR ou pair code abaixo.", token: created.token, baseUrl: created.baseUrl };
  } catch (error) {
    return { status: "error", message: integrationError(error) };
  }
}

export async function generateUazapiPairingAction(_previous: UazapiPairingState, formData: FormData): Promise<UazapiPairingState> {
  const parsed = z.object({ baseUrl: z.string().url(), token: z.string().min(8), phone: z.string().trim().optional() })
    .safeParse({ baseUrl: formData.get("baseUrl"), token: formData.get("token"), phone: String(formData.get("phone") ?? "") || undefined });
  if (!parsed.success) return { status: "error", message: "Revise URL, token e telefone opcional." };
  const viewer = await requireActiveViewer();
  if (viewer.membership?.role !== "owner") return { status: "error", message: "Ação exclusiva do dono." };
  try {
    const pairing = await requestUazapiPairing(parsed.data);
    return { status: "success", message: pairing.pairCode ? "Use o código abaixo no WhatsApp." : "Escaneie o QR Code no WhatsApp.", pairCode: pairing.pairCode, qrImage: pairing.qrImage };
  } catch (error) {
    return { status: "error", message: integrationError(error) };
  }
}
