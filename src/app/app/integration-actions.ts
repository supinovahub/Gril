"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireActiveViewer } from "@/lib/auth/session";
import type { Json, Tables } from "@/lib/database.types";
import { validateMetaCredential } from "@/lib/integrations/meta";
import { validateOpenAiCredential } from "@/lib/integrations/openai";
import {
  IntegrationProviderError,
} from "@/lib/integrations/provider-http";
import { validateUazapiCredential } from "@/lib/integrations/uazapi";
import { createAdminClient } from "@/lib/supabase/admin";

const returnToSchema = z.enum(["/app/configuracoes/whatsapp", "/app/pedro"]);
const actionSchema = z.object({
  integrationAccountId: z.string().uuid(),
  returnTo: returnToSchema,
});

const storedMetaSecretSchema = z.object({
  accessToken: z.string(),
  appSecret: z.string(),
});

function feedback(path: z.infer<typeof returnToSchema>, kind: "erro" | "sucesso", message: string) {
  return `${path}?${kind}=${encodeURIComponent(message)}`;
}

async function loadOwnedAccount(
  accountId: string,
  viewer: Awaited<ReturnType<typeof requireActiveViewer>>,
) {
  if (viewer.membership?.role !== "owner") return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("integration_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("org_id", viewer.organization!.id)
    .neq("status", "revoked")
    .maybeSingle();
  return data;
}

async function resolveSecret(accountId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_integration_secret", {
    p_integration_account_id: accountId,
  });
  if (error || !data) throw new Error("integration_secret_unavailable");
  return data;
}

async function recordCheck(
  account: Tables<"integration_accounts">,
  result: {
    status: "healthy" | "down";
    latencyMs?: number;
    error?: string;
    metadata?: Json;
  },
) {
  const admin = createAdminClient();
  let targetId = account.id;
  let operationId: string | null = null;
  if (account.provider !== "openai") {
    const { data: connection } = await admin
      .from("whatsapp_connections")
      .select("id,operation_id")
      .eq("integration_account_id", account.id)
      .maybeSingle();
    if (connection) {
      targetId = connection.id;
      operationId = connection.operation_id;
      await admin
        .from("whatsapp_connections")
        .update({
          last_health_at: new Date().toISOString(),
          last_error_redacted: result.error ?? null,
        })
        .eq("id", connection.id);
    }
  }

  await Promise.all([
    admin
      .from("integration_accounts")
      .update({
        status: result.status === "healthy" ? "verified" : "error",
        last_checked_at: new Date().toISOString(),
        last_error_redacted: result.error ?? null,
      })
      .eq("id", account.id),
    admin.from("integration_health_checks").insert({
      org_id: account.org_id,
      operation_id: operationId,
      component:
        account.provider === "meta_cloud"
          ? "meta"
          : account.provider === "openai"
            ? "openai"
            : "uazapi",
      target_id: targetId,
      status: result.status,
      latency_ms: result.latencyMs ?? null,
      error_redacted: result.error ?? null,
      metadata: result.metadata ?? { source: "self_service_retest" },
    }),
  ]);
}

export async function retestIntegrationAction(formData: FormData) {
  const parsed = actionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/app");
  const viewer = await requireActiveViewer();
  const account = await loadOwnedAccount(parsed.data.integrationAccountId, viewer);
  if (!account) {
    redirect(feedback(parsed.data.returnTo, "erro", "Integração não encontrada."));
  }

  let successMessage = "Credencial testada com sucesso.";
  let failureMessage: string | null = null;
  try {
    const secret = await resolveSecret(account.id);
    if (account.provider === "uazapi") {
      const result = await validateUazapiCredential({
        baseUrl: account.base_url ?? "",
        token: secret,
      });
      await recordCheck(account, { status: "healthy", latencyMs: result.latencyMs });
      successMessage = "Instância Uazapi saudável.";
    } else if (account.provider === "meta_cloud") {
      const stored = storedMetaSecretSchema.safeParse(JSON.parse(secret));
      if (!stored.success || !account.external_business_id || !account.external_phone_number_id) {
        throw new Error("meta_stored_contract_invalid");
      }
      const result = await validateMetaCredential({
        ...stored.data,
        wabaId: account.external_business_id,
        phoneNumberId: account.external_phone_number_id,
      });
      await recordCheck(account, { status: "healthy", latencyMs: result.latencyMs });
      successMessage = "Conta oficial da Meta saudável.";
    } else {
      const result = await validateOpenAiCredential(secret);
      await recordCheck(account, {
        status: "healthy",
        latencyMs: result.latencyMs,
        metadata: {
          source: "self_service_retest",
          available_model_count: result.modelIds.length,
        },
      });
      successMessage = "Chave da OpenAI saudável.";
    }
  } catch (error) {
    failureMessage =
      error instanceof IntegrationProviderError
        ? error.userMessage
        : "Não foi possível validar essa integração.";
    await recordCheck(account, { status: "down", error: failureMessage });
  }

  revalidatePath(parsed.data.returnTo);
  if (failureMessage) {
    redirect(feedback(parsed.data.returnTo, "erro", failureMessage));
  }
  redirect(feedback(parsed.data.returnTo, "sucesso", successMessage));
}

export async function revokeIntegrationAction(formData: FormData) {
  const parsed = actionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/app");
  const viewer = await requireActiveViewer();
  const account = await loadOwnedAccount(parsed.data.integrationAccountId, viewer);
  if (!account) {
    redirect(feedback(parsed.data.returnTo, "erro", "Integração não encontrada."));
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("revoke_integration_account", {
    p_actor_user_id: viewer.userId,
    p_integration_account_id: account.id,
    p_org_id: viewer.organization!.id,
  });
  if (error) {
    redirect(feedback(parsed.data.returnTo, "erro", "Não foi possível revogar a integração."));
  }

  revalidatePath(parsed.data.returnTo);
  redirect(feedback(parsed.data.returnTo, "sucesso", "Credencial revogada e removida do Vault."));
}
