import "server-only";

import { z } from "zod";

import type { Json } from "@/lib/database.types";
import { createPedroResponse, OpenAiRuntimeError } from "@/lib/integrations/openai-runtime";
import { RuntimeProviderError, sendWhatsappText, type WhatsappProvider } from "@/lib/integrations/whatsapp-runtime";
import { createAdminClient } from "@/lib/supabase/admin";

const queueNames = [
  "ai-turns",
  "scheduled-actions",
  "call-distribution",
  "campaign-dispatch",
  "outbound-whatsapp",
  "notifications",
  "media-processing",
  "reconciliation",
] as const;
type QueueName = (typeof queueNames)[number];

const queueMessageSchema = z.object({
  msg_id: z.coerce.number().int().positive(),
  read_ct: z.number().int().nonnegative(),
  message: z.record(z.string(), z.unknown()),
});

const executionResultSchema = z.object({
  status: z.string(),
  execution_id: z.string().uuid().nullable().optional(),
});

const outboundClaimSchema = z.object({
  status: z.string(),
  message_id: z.string().uuid().optional(),
  connection_id: z.string().uuid().optional(),
  integration_account_id: z.string().uuid().optional(),
  provider: z.enum(["uazapi", "meta_cloud"]).optional(),
  endpoint_url: z.string().url().optional(),
  to_e164: z.string().optional(),
  body: z.string().optional(),
});

const jobResultSchema = z.object({
  status: z.string(),
  message_id: z.string().uuid().optional(),
  retry_seconds: z.number().int().positive().optional(),
  reason: z.string().optional(),
});

function controlIntent(message: { body: string | null; content_type: string }) {
  const body = message.body?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() ?? "";
  if (message.content_type === "document") return "sensitive_document" as const;
  if (/\b(lgpd|privacidade|meus dados|apagar meus dados|excluir meus dados|como conseguiu meu contato)\b/.test(body)) return "privacy" as const;
  if (/\b(stop|pare|parar|sair|cancela|cancelar|nao quero mais|nao me mande|remova meu numero|descadastrar)\b/.test(body)) return "opt_out" as const;
  return null;
}

async function runAiExecution(executionId: string) {
  const admin = createAdminClient();
  const { data: started, error: startError } = await admin.rpc("start_ai_execution", { p_execution_id: executionId });
  if (startError) throw startError;
  if (!started) return "ignored";

  try {
    const { data: execution, error: executionError } = await admin
      .from("ai_executions")
      .select("*")
      .eq("id", executionId)
      .single();
    if (executionError || !execution.model_profile_id) throw executionError ?? new Error("model_profile_missing");
    const { data: model, error: modelError } = await admin
      .from("model_profiles")
      .select("*")
      .eq("id", execution.model_profile_id)
      .single();
    if (modelError || !model.integration_account_id) throw modelError ?? new Error("openai_integration_missing");
    const { data: apiKey, error: secretError } = await admin.rpc("get_integration_secret", {
      p_integration_account_id: model.integration_account_id,
    });
    if (secretError || !apiKey) throw secretError ?? new Error("openai_secret_missing");

    let instructions = "Responda em português brasileiro. Use apenas fatos aprovados no contexto. Se faltar um fato necessário, escale em vez de inventar.";
    if (execution.context_version_id) {
      const { data: context } = await admin
        .from("conversation_context_versions")
        .select("persona_version_id,rule_version_id,institutional_snapshot")
        .eq("id", execution.context_version_id)
        .single();
      if (context) {
        const [{ data: persona }, { data: rules }] = await Promise.all([
          admin.from("persona_versions").select("compiled_prompt").eq("id", context.persona_version_id).single(),
          admin.from("rule_versions").select("compiled_rules").eq("id", context.rule_version_id).single(),
        ]);
        instructions = [
          persona?.compiled_prompt ?? instructions,
          `Regras determinísticas: ${JSON.stringify(rules?.compiled_rules ?? {})}`,
          `Perfil institucional aprovado: ${JSON.stringify(context.institutional_snapshot ?? {})}`,
          "Nunca afirme experiência pessoal, preço, disponibilidade, rentabilidade ou condição comercial que não esteja explicitamente no contexto. Não revele ser IA. Não solicite documentos sensíveis. Para risco jurídico, privacidade, fraude ou ausência de fato aprovado, use action=escalate.",
        ].join("\n\n");
      }
    }

    const conversationMessages: Array<{ role: "user" | "assistant"; text: string }> = [];
    if (execution.conversation_id) {
      const { data: messages, error: messagesError } = await admin
        .from("messages")
        .select("direction,content_type,body,created_at")
        .eq("conversation_id", execution.conversation_id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (messagesError) throw messagesError;
      for (const message of [...(messages ?? [])].reverse()) {
        conversationMessages.push({
          role: message.direction === "inbound" ? "user" : "assistant",
          text: message.body ?? `[${message.content_type}]`,
        });
      }
    } else {
      conversationMessages.push({ role: "user", text: JSON.stringify(execution.input_snapshot) });
    }
    if (conversationMessages.length === 0) throw new Error("ai_input_missing");

    const startedAt = Date.now();
    const response = await createPedroResponse({
      apiKey,
      model: model.model_identifier,
      reasoningEffort: model.reasoning_effort,
      textVerbosity: model.text_verbosity,
      instructions,
      messages: conversationMessages,
    });
    const { error: completeError } = await admin.rpc("complete_ai_execution", {
      p_execution_id: executionId,
      p_input_tokens: response.inputTokens,
      p_latency_ms: Date.now() - startedAt,
      p_model_returned: response.model,
      p_output_structured: response.structured as Json,
      p_output_text: response.outputText,
      p_output_tokens: response.outputTokens,
      p_response_id: response.responseId,
    });
    if (completeError) throw completeError;
    return "completed";
  } catch (error) {
    if (error instanceof OpenAiRuntimeError && error.retryable) {
      await admin.rpc("retry_ai_execution", {
        p_error_code: error.code,
        p_error_redacted: error.redactedMessage,
        p_execution_id: executionId,
      });
      throw error;
    }
    const code = error instanceof OpenAiRuntimeError ? error.code : "ai_worker_error";
    const message = error instanceof OpenAiRuntimeError ? error.redactedMessage : "A execução do Pedro falhou antes de produzir uma resposta válida.";
    await admin.rpc("fail_ai_execution", { p_error_code: code, p_error_redacted: message, p_execution_id: executionId });
    return "failed";
  }
}

async function processAiMessage(message: Record<string, unknown>) {
  const admin = createAdminClient();
  const eventType = typeof message.event_type === "string" ? message.event_type : "";
  const payload = message.payload && typeof message.payload === "object" ? message.payload as Record<string, unknown> : {};
  if (eventType.startsWith("message.inbound")) {
    const messageId = z.string().uuid().parse(payload.message_id);
    const { data: inbound } = await admin.from("messages").select("body,content_type").eq("id", messageId).single();
    if (!inbound) return;
    const intent = controlIntent(inbound);
    if (intent) {
      const { error } = await admin.rpc("apply_inbound_control_intent", { p_intent: intent, p_message_id: messageId });
      if (error) throw error;
      return;
    }
    const { data, error } = await admin.rpc("ensure_inbound_ai_execution", { p_message_id: messageId });
    if (error) throw error;
    const parsed = executionResultSchema.parse(data);
    if (parsed.execution_id && ["queued", "existing"].includes(parsed.status)) await runAiExecution(parsed.execution_id);
    return;
  }
  if (eventType.startsWith("ai.")) {
    const executionId = z.string().uuid().parse(payload.execution_id ?? message.aggregate_id);
    await runAiExecution(executionId);
  }
}

async function processOutboundMessage(messageId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_outbound_message", { p_message_id: messageId });
  if (error) throw error;
  const claim = outboundClaimSchema.parse(data);
  if (claim.status !== "claimed") return claim.status;
  if (!claim.integration_account_id || !claim.provider || !claim.endpoint_url || !claim.to_e164 || !claim.body) {
    await admin.rpc("fail_outbound_message", {
      p_error_code: "outbound_context_missing",
      p_error_redacted: "A conexão não forneceu todos os dados necessários para o envio.",
      p_message_id: messageId,
    });
    return "failed";
  }
  const [{ data: secret, error: secretError }, { data: account, error: accountError }] = await Promise.all([
    admin.rpc("get_integration_secret", { p_integration_account_id: claim.integration_account_id }),
    admin.from("integration_accounts").select("external_phone_number_id").eq("id", claim.integration_account_id).single(),
  ]);
  if (secretError || accountError || !secret) throw secretError ?? accountError ?? new Error("integration_secret_missing");
  try {
    const sent = await sendWhatsappText({
      provider: claim.provider as WhatsappProvider,
      endpointUrl: claim.endpoint_url,
      secret,
      externalPhoneNumberId: account.external_phone_number_id,
      toE164: claim.to_e164,
      body: claim.body,
      messageId,
    });
    const { error: completeError } = await admin.rpc("complete_outbound_message", {
      p_message_id: messageId,
      p_provider_message_id: sent.providerMessageId,
      p_provider_timestamp: sent.providerTimestamp,
    });
    if (completeError) throw completeError;
    return "sent";
  } catch (sendError) {
    if (sendError instanceof RuntimeProviderError && sendError.retryable) throw sendError;
    await admin.rpc("fail_outbound_message", {
      p_error_code: sendError instanceof RuntimeProviderError ? sendError.code : "provider_send_error",
      p_error_redacted: sendError instanceof RuntimeProviderError ? sendError.redactedMessage : "O envio falhou antes da confirmação do provedor.",
      p_message_id: messageId,
    });
    return "failed";
  }
}

async function processRuntimeJob(message: Record<string, unknown>) {
  const admin = createAdminClient();
  const jobId = z.string().uuid().parse(message.job_id);
  const { data, error } = await admin.rpc("execute_runtime_job", { p_job_id: jobId });
  if (error) throw error;
  const result = jobResultSchema.parse(data);
  if (result.status === "send" && result.message_id) {
    try {
      await processOutboundMessage(result.message_id);
      await admin.rpc("finish_runtime_job", { p_error_redacted: undefined, p_job_id: jobId, p_retry_seconds: 30, p_success: true });
    } catch (sendError) {
      if (sendError instanceof RuntimeProviderError && sendError.retryable) {
        await admin.rpc("finish_runtime_job", { p_error_redacted: sendError.redactedMessage, p_job_id: jobId, p_retry_seconds: 60, p_success: false });
        return;
      }
      throw sendError;
    }
    return;
  }
  if (result.status === "retry") {
    await admin.rpc("finish_runtime_job", {
      p_error_redacted: result.reason ?? "retry_requested",
      p_job_id: jobId,
      p_retry_seconds: result.retry_seconds ?? 30,
      p_success: false,
    });
    return;
  }
  const success = ["completed", "cancelled", "ignored"].includes(result.status);
  await admin.rpc("finish_runtime_job", {
    p_error_redacted: success ? undefined : result.reason ?? result.status,
    p_job_id: jobId,
    p_retry_seconds: 30,
    p_success: success,
  });
}

async function processQueueItem(queue: QueueName, item: z.infer<typeof queueMessageSchema>) {
  const message = item.message;
  if (queue === "ai-turns") return processAiMessage(message);
  if (queue === "outbound-whatsapp") {
    const payload = message.payload && typeof message.payload === "object" ? message.payload as Record<string, unknown> : {};
    const messageId = z.string().uuid().parse(payload.message_id ?? message.aggregate_id);
    await processOutboundMessage(messageId);
    if (typeof message.job_id === "string") {
      const admin = createAdminClient();
      await admin.rpc("finish_runtime_job", { p_error_redacted: undefined, p_job_id: message.job_id, p_retry_seconds: 30, p_success: true });
    }
    return;
  }
  if (typeof message.job_id === "string") return processRuntimeJob(message);
  const admin = createAdminClient();
  const { error } = await admin.rpc("consume_runtime_event", { p_event: message as Json });
  if (error) throw error;
}

async function drainQueue(queue: QueueName) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("runtime_queue_read", {
    p_limit: 5,
    p_queue_name: queue,
    p_visibility_timeout: 90,
  });
  if (error) throw error;
  let completed = 0;
  let retried = 0;
  for (const raw of data ?? []) {
    const item = queueMessageSchema.parse(raw);
    try {
      await processQueueItem(queue, item);
      await admin.rpc("runtime_queue_archive", { p_msg_id: item.msg_id, p_queue_name: queue });
      completed += 1;
    } catch (itemError) {
      const retryable = itemError instanceof OpenAiRuntimeError && itemError.retryable
        || itemError instanceof RuntimeProviderError && itemError.retryable;
      if (retryable && item.read_ct < 3) {
        await admin.rpc("runtime_queue_retry", { p_delay_seconds: 60, p_msg_id: item.msg_id, p_queue_name: queue });
        retried += 1;
      } else {
        await admin.rpc("runtime_queue_archive", { p_msg_id: item.msg_id, p_queue_name: queue });
      }
    }
  }
  return { completed, retried };
}

async function drainRetention() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_retention_purge", { p_limit: 10 });
  if (error) throw error;
  let completed = 0;
  for (const item of data ?? []) {
    if (!item.storage_bucket || !item.storage_path || item.action !== "delete") {
      await admin.rpc("finish_retention_purge", { p_error_redacted: "Ação de retenção requer revisão manual.", p_id: item.id, p_success: false });
      continue;
    }
    const { error: removeError } = await admin.storage.from(item.storage_bucket).remove([item.storage_path]);
    await admin.rpc("finish_retention_purge", {
      p_error_redacted: removeError ? "O Storage não confirmou a remoção física do objeto." : undefined,
      p_id: item.id,
      p_success: !removeError,
    });
    if (!removeError) completed += 1;
  }
  return completed;
}

export async function drainRuntimeWorker() {
  const admin = createAdminClient();
  const summary: Record<string, { completed: number; retried: number }> = {};
  for (let pass = 0; pass < 2; pass += 1) {
    const { error: dispatchError } = await admin.rpc("dispatch_runtime_sources", { p_batch_size: 100 });
    if (dispatchError) throw dispatchError;
    for (const queue of queueNames) {
      const result = await drainQueue(queue);
      const previous = summary[queue] ?? { completed: 0, retried: 0 };
      summary[queue] = { completed: previous.completed + result.completed, retried: previous.retried + result.retried };
    }
  }
  const purged = await drainRetention();
  await admin.from("integration_health_checks").insert({
    component: "queues",
    status: "healthy",
    metadata: { source: "runtime_worker", summary, purged },
  });
  return { ok: true, summary, purged };
}
