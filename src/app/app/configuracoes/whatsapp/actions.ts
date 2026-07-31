"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireActiveViewer } from "@/lib/auth/session";
import type { Json } from "@/lib/database.types";
import { IntegrationProviderError } from "@/lib/integrations/provider-http";
import { validateMetaCredential } from "@/lib/integrations/meta";
import { validateUazapiCredential } from "@/lib/integrations/uazapi";
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
  const supabase = await createClient();
  const { error } = await supabase.from("connection_activation_requests").insert({
    org_id: viewer.organization!.id,
    connection_id: parsed.data.connectionId,
    action: parsed.data.action,
    inbound_enabled: formData.get("inboundEnabled") === "on",
    campaign_enabled: formData.get("campaignEnabled") === "on",
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
