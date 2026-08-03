import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import webpush from "web-push";

import {
  appendProjectRecommendations,
  mergeQualificationValues,
  selectEligibleProjects,
  type ProjectCandidate,
  type QualificationValue,
} from "@/lib/ai/pedro-turn";
import { evaluateRegressionCase } from "@/lib/ai/regression";
import {
  buildSimulatorConversation,
  buildSimulatorQualificationValues,
  latestSimulatorSummary,
  parseSimulatorExecutionSnapshot,
  type SimulatorPriorTurn,
} from "@/lib/ai/simulator-session";
import type { Json } from "@/lib/database.types";
import { createPedroResponse, OpenAiRuntimeError } from "@/lib/integrations/openai-runtime";
import { extractMediaText } from "@/lib/integrations/openai-media";
import { downloadWhatsappMedia, RuntimeProviderError, sendWhatsappMedia, sendWhatsappText, type WhatsappProvider } from "@/lib/integrations/whatsapp-runtime";
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
  ai_execution_id: z.string().uuid().optional(),
  retry_seconds: z.number().int().positive().optional(),
  reason: z.string().optional(),
  run_id: z.string().uuid().optional(),
  case_id: z.string().uuid().optional(),
});

const outboundTemplateSchema = z.object({
  required: z.boolean().default(false), missing: z.boolean().default(false),
  name: z.string().nullable().optional(), language: z.string().nullable().optional(),
  parameters: z.array(z.string()).default([]), purpose: z.string().nullable().optional(),
  strategy: z.enum(["none", "first_name", "body", "call_datetime", "call_link"]).nullable().optional(),
});

const mediaClaimSchema = z.object({
  status: z.string(), message_id: z.string().uuid().optional(), org_id: z.string().uuid().optional(),
  integration_account_id: z.string().uuid().optional(), provider: z.enum(["uazapi", "meta_cloud"]).optional(),
  endpoint_url: z.string().url().optional(), provider_media_id: z.string().nullable().optional(), source_url: z.string().url().nullable().optional(),
  mime_type: z.string().optional(), file_name: z.string().nullable().optional(), content_type: z.string().optional(),
});

const regressionClaimSchema = z.object({
  status: z.string(), result_id: z.string().uuid().optional(), integration_account_id: z.string().uuid().optional(),
  input: z.string().optional(), initial_state: z.unknown().optional(), expected_response: z.string().nullable().optional(),
  rubric: z.unknown().optional(), allowed_actions: z.array(z.string()).optional(), prohibited_actions: z.array(z.string()).optional(),
  rules: z.unknown().optional(), model: z.string().optional(),
});

const platformPushClaimSchema = z.array(z.object({
  id: z.string().uuid(),
  recipient_user_id: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  url: z.string(),
  subscriptions: z.array(z.object({
    id: z.string().uuid(), endpoint: z.string().url(), p256dh: z.string(), auth_key: z.string(),
  })).default([]),
}));

function hasExplicitCallConfirmation(messages: Array<{ role: "user" | "assistant"; text: string }>) {
  const latest = [...messages].reverse().find((message) => message.role === "user")?.text
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() ?? "";
  const acceptance = /\b(sim|pode|confirmo|confirmado|fechado|combinado|marcar|agendar|agenda|vamos)\b/.test(latest);
  const time = /\b(?:[01]?\d|2[0-3])(?::[0-5]\d|h(?:[0-5]\d)?)\b/.test(latest);
  const date = /\b(hoje|amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo|\d{1,2}[/-]\d{1,2})\b/.test(latest);
  return acceptance && time && date;
}

function validCallRequest(
  request: { starts_at: string; format: "video" | "phone" | "unknown" } | null,
  messages: Array<{ role: "user" | "assistant"; text: string }>,
) {
  if (!request || !hasExplicitCallConfirmation(messages)) return null;
  const startsAt = new Date(request.starts_at);
  const minimum = Date.now() + 10 * 60_000;
  const maximum = Date.now() + 365 * 24 * 60 * 60_000;
  return Number.isFinite(startsAt.valueOf()) && startsAt.valueOf() > minimum && startsAt.valueOf() < maximum
    ? request
    : null;
}

function controlIntent(message: { body: string | null; content_type: string }) {
  const body = message.body?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() ?? "";
  if (message.content_type === "document") return "sensitive_document" as const;
  if (/\b(pix|boleto|dados bancarios|chave pix|comprovante|pagar|pagamento|sinal|reserva)\b/.test(body)) return "payment" as const;
  if (/\b(numero errado|pessoa errada|nao sou|nao conheco|esse numero nao e|esse numero nao pertence)\b/.test(body)) return "wrong_number" as const;
  if (/\b(nunca me cadastrei|nao me cadastrei|nao autorizei|nao dei meu contato|de onde tirou meu numero)\b/.test(body)) return "origin_contested" as const;
  if (/\b(voce e (uma )?(ia|inteligencia artificial|robo|bot)|estou falando com (uma )?(ia|robo|bot))\b/.test(body)) return "identity_question" as const;
  if (/\b(lgpd|privacidade|meus dados|apagar meus dados|excluir meus dados|como conseguiu meu contato)\b/.test(body)) return "privacy" as const;
  if (/\b(stop|pare|parar|sair|cancela|cancelar|nao quero mais|nao me mande|remova meu numero|descadastrar)\b/.test(body)) return "opt_out" as const;
  return null;
}

function compilePedroInstructions(
  personaPrompt: string | null | undefined,
  compiledRules: Json,
  institutionalSnapshot: Json,
) {
  const fallback = "Responda em português brasileiro. Use apenas fatos aprovados no contexto. Se faltar um fato necessário, escale em vez de inventar.";
  return [
    personaPrompt ?? fallback,
    `Regras determinísticas: ${JSON.stringify(compiledRules ?? {})}`,
    `Perfil institucional aprovado: ${JSON.stringify(institutionalSnapshot ?? {})}`,
    "Nunca afirme experiência pessoal, preço, disponibilidade, rentabilidade ou condição comercial que não esteja explicitamente no contexto. Não revele ser IA. Não solicite documentos sensíveis. Para risco jurídico, privacidade, fraude ou ausência de fato aprovado, use action=escalate.",
    "Registre qualificação somente quando o contato tiver informado o dado. Nunca estime renda, entrada, orçamento ou prazo.",
    "Solicite curadoria apenas quando preço total e entrada estiverem disponíveis. O backend fará o filtro final e acrescentará os imóveis elegíveis.",
    "Crie call somente quando o contato tiver aceitado explicitamente uma data e um horário. Caso contrário, pergunte a preferência sem criar a call.",
    "Use followup_strategy=short quando a conversa deve ser retomada em curto prazo, long para nutrição, future quando o lead declarou compra futura sem prazo exato, e cancel para resposta, opt-out, call confirmada ou ownership humano.",
    "Ao recomendar um empreendimento, project_media_request deve ficar null: o servidor enviará apenas a foto principal. Se o lead pedir mais material, primeiro pergunte se prefere mais fotos ou o book completo. Depois da escolha, use project_media_request com more_photos ou book, nunca ambos. Nunca envie áudio.",
    "Uma reação 👍 só significa sim quando responde a uma pergunta binária textual clara; reação a imagem ou material não prova interesse.",
  ].join("\n\n");
}

async function runAiExecution(executionId: string) {
  const admin = createAdminClient();
  let activeModelProfileId: string | null = null;
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
    activeModelProfileId = execution.model_profile_id;
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

    let instructions = compilePedroInstructions(null, {}, {});
    let personaVersionId: string | null = null;
    let ruleVersionId: string | null = null;
    if (execution.context_version_id) {
      const { data: context } = await admin
        .from("conversation_context_versions")
        .select("persona_version_id,rule_version_id,institutional_snapshot")
        .eq("id", execution.context_version_id)
        .single();
      if (context) {
        personaVersionId = context.persona_version_id;
        ruleVersionId = context.rule_version_id;
        const [{ data: persona }, { data: rules }] = await Promise.all([
          admin.from("persona_versions").select("compiled_prompt").eq("id", context.persona_version_id).single(),
          admin.from("rule_versions").select("compiled_rules").eq("id", context.rule_version_id).single(),
        ]);
        instructions = compilePedroInstructions(
          persona?.compiled_prompt,
          rules?.compiled_rules ?? {},
          context.institutional_snapshot ?? {},
        );
      }
    } else if (execution.mode === "simulator") {
      const [{ data: persona }, { data: rules }, { data: settings }] = await Promise.all([
        admin.from("persona_versions").select("id,compiled_prompt").eq("org_id", execution.org_id).eq("status", "published").order("version", { ascending: false }).limit(1).maybeSingle(),
        admin.from("rule_versions").select("id,compiled_rules").eq("org_id", execution.org_id).eq("status", "published").order("version", { ascending: false }).limit(1).maybeSingle(),
        admin.from("organization_settings").select("institutional_profile").eq("org_id", execution.org_id).maybeSingle(),
      ]);
      personaVersionId = persona?.id ?? null;
      ruleVersionId = rules?.id ?? null;
      instructions = compilePedroInstructions(
        persona?.compiled_prompt,
        rules?.compiled_rules ?? {},
        settings?.institutional_profile ?? {},
      );
    }

    const conversationMessages: Array<{ role: "user" | "assistant"; text: string }> = [];
    let priorSummary: { summary: string; facts: Json } | null = null;
    let simulatorInitialState: unknown = {};
    let simulatorQualificationValues: QualificationValue[] = [];
    const simulatorSnapshot = execution.mode === "simulator"
      ? parseSimulatorExecutionSnapshot(execution.input_snapshot)
      : null;
    if (execution.conversation_id) {
      const [{ data: messages, error: messagesError }, { data: summary }] = await Promise.all([
        admin.from("messages").select("direction,content_type,body,created_at,metadata").eq("conversation_id", execution.conversation_id).order("created_at", { ascending: false }).limit(40),
        admin.from("conversation_summaries").select("summary,facts").eq("conversation_id", execution.conversation_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (messagesError) throw messagesError;
      priorSummary = summary;
      for (const message of [...(messages ?? [])].reverse()) {
        if ((message.metadata as { excluded_from_ai?: boolean } | null)?.excluded_from_ai) continue;
        conversationMessages.push({
          role: message.direction === "inbound" ? "user" : "assistant",
          text: message.body ?? `[${message.content_type}]`,
        });
      }
    } else if (simulatorSnapshot) {
      const { data: priorTurns, error: priorTurnsError } = await admin
        .from("simulator_runs")
        .select("turn_index,simulated_input,output_text,output_structured,status")
        .eq("org_id", execution.org_id)
        .eq("session_id", simulatorSnapshot.simulator_session_id)
        .lt("turn_index", simulatorSnapshot.simulator_turn_index)
        .order("turn_index", { ascending: false })
        .limit(200);
      if (priorTurnsError) throw priorTurnsError;
      const history = (priorTurns ?? []) as SimulatorPriorTurn[];
      conversationMessages.push(...buildSimulatorConversation(simulatorSnapshot.input, history.slice(0, 20)));
      simulatorInitialState = simulatorSnapshot.initial_state ?? {};
      simulatorQualificationValues = buildSimulatorQualificationValues(simulatorInitialState, history);
      const summary = latestSimulatorSummary(history);
      priorSummary = summary ? { summary: summary.summary, facts: summary.facts } : null;
    } else {
      conversationMessages.push({ role: "user", text: JSON.stringify(execution.input_snapshot) });
    }
    if (conversationMessages.length === 0) throw new Error("ai_input_missing");

    const opportunityId = execution.conversation_id
      ? (await admin.from("conversations").select("opportunity_id,operation_id").eq("id", execution.conversation_id).single()).data?.opportunity_id
      : null;
    const [definitionsResult, valuesResult, projectsResult, faqEntriesResult, projectFactsResult, projectMediaResult] = await Promise.all([
      admin.from("qualification_definitions")
        .select("id,code,name,intent,answer_type,required,priority,suggested_order")
        .eq("org_id", execution.org_id).eq("active", true).order("suggested_order"),
      opportunityId
        ? admin.from("qualification_values")
          .select("definition_id,value_text,value_number,value_boolean,state,confidence,human_confirmed,valid_until")
          .eq("opportunity_id", opportunityId).in("state", ["valid", "refused", "unknown"])
        : Promise.resolve({ data: [], error: null }),
      admin.from("projects")
        .select("id,name,region,neighborhood,summary,delivery_type,min_price,min_down_payment,commercial_priority,valid_until")
        .eq("org_id", execution.org_id).eq("status", "active").eq("recommendable", true).limit(50),
      admin.from("faq_entries").select("id,canonical_question").eq("org_id", execution.org_id).eq("status", "published").limit(50),
      admin.from("project_facts").select("project_id,code,value_text,value_number,unit,source_name,reference_date,valid_until")
        .eq("org_id", execution.org_id).eq("active", true),
      admin.from("project_media").select("project_id,media_type,title,external_url,storage_path,sort_order,mime_type,size_bytes,published_at")
        .eq("org_id", execution.org_id).eq("active", true).not("published_at", "is", null).order("sort_order"),
    ]);
    if (definitionsResult.error || valuesResult.error || projectsResult.error || faqEntriesResult.error || projectFactsResult.error || projectMediaResult.error) {
      throw definitionsResult.error ?? valuesResult.error ?? projectsResult.error ?? faqEntriesResult.error ?? projectFactsResult.error ?? projectMediaResult.error;
    }
    const definitions = definitionsResult.data ?? [];
    const definitionById = new Map(definitions.map((item) => [item.id, item]));
    const definitionCodes = new Set(definitions.map((definition) => definition.code));
    const currentValues: QualificationValue[] = (opportunityId
      ? (valuesResult.data ?? []).map((value) => ({
        code: definitionById.get(value.definition_id)?.code ?? "unknown",
        valueText: value.value_text,
        valueNumber: value.value_number === null ? null : Number(value.value_number),
        valueBoolean: value.value_boolean,
      }))
      : simulatorQualificationValues
    ).filter((value) => value.code !== "unknown" && definitionCodes.has(value.code));
    const projects: ProjectCandidate[] = (projectsResult.data ?? [])
      .filter((project) => !project.valid_until || project.valid_until >= new Date().toISOString().slice(0, 10))
      .map((project) => ({
        id: project.id,
        name: project.name,
        region: project.region,
        neighborhood: project.neighborhood,
        summary: project.summary,
        deliveryType: project.delivery_type,
        minPrice: project.min_price === null ? null : Number(project.min_price),
        minDownPayment: project.min_down_payment === null ? null : Number(project.min_down_payment),
        commercialPriority: project.commercial_priority,
      }));
    const faqIds = (faqEntriesResult.data ?? []).map((item) => item.id);
    const faqVersionsResult = faqIds.length
      ? await admin.from("faq_versions").select("faq_entry_id,base_answer,response_mode,caveats,valid_until")
        .in("faq_entry_id", faqIds).eq("status", "published")
      : { data: [], error: null };
    if (faqVersionsResult.error) throw faqVersionsResult.error;
    const faqQuestionById = new Map((faqEntriesResult.data ?? []).map((item) => [item.id, item.canonical_question]));

    const startedAt = Date.now();
    const response = await createPedroResponse({
      apiKey,
      model: model.model_identifier,
      reasoningEffort: model.reasoning_effort,
      textVerbosity: model.text_verbosity,
      instructions,
      messages: conversationMessages,
      businessContext: {
        now_iso: new Date().toISOString(),
        timezone: execution.operation_id
          ? (await admin.from("operations").select("timezone").eq("id", execution.operation_id).single()).data?.timezone ?? "America/Sao_Paulo"
          : "America/Sao_Paulo",
        opportunity_id: opportunityId,
        qualification_definitions: definitions.map((definition) => ({
          code: definition.code,
          name: definition.name,
          intent: definition.intent,
          answer_type: definition.answer_type,
          required: definition.required,
        })),
        current_qualification: currentValues,
        previous_conversation_summary: priorSummary,
        simulator_state: simulatorSnapshot ? simulatorInitialState : null,
        simulator_session: simulatorSnapshot ? {
          id: simulatorSnapshot.simulator_session_id,
          turn: simulatorSnapshot.simulator_turn_index,
        } : null,
        active_projects: projects,
        approved_project_facts: (projectFactsResult.data ?? []).filter((fact) => !fact.valid_until || fact.valid_until >= new Date().toISOString().slice(0, 10)),
        approved_project_media: projectMediaResult.data ?? [],
        published_faqs: (faqVersionsResult.data ?? []).map((faq) => ({
          question: faqQuestionById.get(faq.faq_entry_id),
          answer: faq.base_answer,
          response_mode: faq.response_mode,
          caveats: faq.caveats,
          valid_until: faq.valid_until,
        })),
      },
    });

    const allowedDefinitions = new Map(definitions.map((definition) => [definition.code, definition.answer_type]));
    const qualificationUpdates = response.structured.qualification_updates.filter((update) => {
      const answerType = allowedDefinitions.get(update.code);
      if (!answerType) return false;
      if (["refused", "unknown"].includes(update.value_kind)) return true;
      if (["money", "number"].includes(answerType)) return update.value_kind === "number";
      if (answerType === "boolean") return update.value_kind === "boolean";
      return update.value_kind === "text";
    });
    const mergedValues = mergeQualificationValues(currentValues, qualificationUpdates);
    const recommendedProjects = response.structured.request_project_match
      ? selectEligibleProjects(projects, mergedValues)
      : [];
    const callRequest = validCallRequest(response.structured.call_request, conversationMessages);
    const outputText = appendProjectRecommendations(response.outputText, recommendedProjects);
    const structured = {
      ...response.structured,
      qualification_updates: qualificationUpdates,
      call_request: callRequest,
      action: response.structured.outcome,
      escalation_reason: response.structured.escalation?.reason ?? null,
      recommended_project_ids: recommendedProjects.map((project) => project.id),
      context_trace: {
        persona_version_id: personaVersionId,
        rule_version_id: ruleVersionId,
        qualification_codes: definitions.map((definition) => definition.code),
        active_project_names: projects.map((project) => project.name),
        approved_sources: [...new Set((projectFactsResult.data ?? []).map((fact) => fact.source_name).filter(Boolean))],
        published_faq_count: faqVersionsResult.data?.length ?? 0,
        simulator_session_id: simulatorSnapshot?.simulator_session_id ?? null,
        simulator_turn_index: simulatorSnapshot?.simulator_turn_index ?? null,
      },
    };
    const { error: completeError } = await admin.rpc("complete_pedro_turn", {
      p_execution_id: executionId,
      p_input_tokens: response.inputTokens,
      p_latency_ms: Date.now() - startedAt,
      p_model_returned: response.model,
      p_output_structured: structured as Json,
      p_output_text: outputText,
      p_output_tokens: response.outputTokens,
      p_response_id: response.responseId,
    });
    if (completeError) throw completeError;
    const { error: mediaEnqueueError } = await admin.rpc("enqueue_pedro_project_media", { p_execution_id: executionId });
    if (mediaEnqueueError) throw mediaEnqueueError;
    if (execution.conversation_id) {
      const { error: summaryError } = await admin.rpc("store_conversation_summary", {
        p_conversation_id: execution.conversation_id,
        p_facts: response.structured.conversation_summary.facts as Json,
        p_source_execution_id: executionId,
        p_summary: response.structured.conversation_summary.summary,
      });
      if (summaryError) throw summaryError;
    }
    return "completed";
  } catch (error) {
    if (error instanceof OpenAiRuntimeError && error.retryable) {
      const { data: execution } = await admin
        .from("ai_executions")
        .select("org_id")
        .eq("id", executionId)
        .single();
      const { data: settings } = execution
        ? await admin
          .from("organization_settings")
          .select("fallback_model_profile_id")
          .eq("org_id", execution.org_id)
          .single()
        : { data: null };
      const fallbackId = settings?.fallback_model_profile_id ?? null;
      if (fallbackId && fallbackId !== activeModelProfileId) {
        const { data: fallback } = await admin
          .from("model_profiles")
          .select("id,integration_account_id,secret_reference")
          .eq("id", fallbackId)
          .eq("org_id", execution!.org_id)
          .maybeSingle();
        if (fallback?.integration_account_id && fallback.secret_reference) {
          await admin.rpc("retry_ai_execution", {
            p_error_code: `${error.code}_fallback`,
            p_error_redacted: "Falha transitória no modelo principal; fallback aprovado acionado.",
            p_execution_id: executionId,
          });
          const { error: fallbackUpdateError } = await admin
            .from("ai_executions")
            .update({ model_profile_id: fallback.id })
            .eq("id", executionId)
            .eq("status", "queued");
          if (!fallbackUpdateError) return runAiExecution(executionId);
        }
      }
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
    if (["image", "audio", "video"].includes(inbound.content_type) && !inbound.body) {
      const { data: media } = await admin.from("message_media_sources").select("status").eq("message_id", messageId).maybeSingle();
      if (!media || ["pending", "processing"].includes(media.status)) return;
    }
    const { error } = await admin.rpc("schedule_inbound_ai_aggregation", { p_message_id: messageId });
    if (error) throw error;
    return;
  }
  if (eventType.startsWith("ai.")) {
    const executionId = z.string().uuid().parse(payload.execution_id ?? message.aggregate_id);
    await runAiExecution(executionId);
  }
}

function safeMediaFileName(messageId: string, fileName: string | null | undefined, mimeType: string) {
  const extensionByMime: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "audio/mpeg": "mp3",
    "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/webm": "webm", "video/mp4": "mp4",
    "application/pdf": "pdf", "text/plain": "txt",
  };
  const sanitized = fileName?.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
  return sanitized || `${messageId}.${extensionByMime[mimeType] ?? "bin"}`;
}

async function processInboundMedia(messageId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_inbound_media", { p_message_id: messageId });
  if (error) throw error;
  const claim = mediaClaimSchema.parse(data);
  if (claim.status !== "claimed") return claim.status;
  if (!claim.org_id || !claim.integration_account_id || !claim.provider || !claim.endpoint_url || !claim.content_type) {
    await admin.rpc("complete_inbound_media", {
      p_message_id: messageId, p_storage_bucket: "", p_storage_path: "", p_mime_type: "application/octet-stream",
      p_size_bytes: 0, p_sha256: "0".repeat(64), p_error_redacted: "Faltam dados do provedor para processar a mídia.",
    });
    return "failed";
  }
  try {
    const { data: whatsappSecret, error: secretError } = await admin.rpc("get_integration_secret", { p_integration_account_id: claim.integration_account_id });
    if (secretError || !whatsappSecret) throw secretError ?? new Error("whatsapp_media_secret_missing");
    const downloaded = await downloadWhatsappMedia({
      provider: claim.provider, endpointUrl: claim.endpoint_url, secret: whatsappSecret,
      providerMediaId: claim.provider_media_id, sourceUrl: claim.source_url,
    });
    const mimeType = downloaded.mimeType ?? claim.mime_type ?? "application/octet-stream";
    const fileName = safeMediaFileName(messageId, claim.file_name, mimeType);
    const sha256 = createHash("sha256").update(downloaded.bytes).digest("hex");
    const storagePath = `${claim.org_id}/${messageId}/${fileName}`;
    const { error: uploadError } = await admin.storage.from("gril-media").upload(storagePath, downloaded.bytes, {
      contentType: mimeType, upsert: false,
    });
    if (uploadError && !uploadError.message.toLowerCase().includes("already exists")) throw uploadError;

    let extractedText: string | null = null;
    if (["audio", "image"].includes(claim.content_type)) {
      const { data: model } = await admin.from("model_profiles").select("model_identifier,integration_account_id")
        .eq("org_id", claim.org_id).eq("status", "active").order("is_default", { ascending: false }).limit(1).maybeSingle();
      if (!model?.integration_account_id) throw new Error("openai_media_profile_missing");
      const { data: openAiSecret, error: openAiSecretError } = await admin.rpc("get_integration_secret", { p_integration_account_id: model.integration_account_id });
      if (openAiSecretError || !openAiSecret) throw openAiSecretError ?? new Error("openai_media_secret_missing");
      extractedText = await extractMediaText({ apiKey: openAiSecret, model: model.model_identifier, bytes: downloaded.bytes,
        mimeType, fileName, contentType: claim.content_type });
    }
    const { error: completeError } = await admin.rpc("complete_inbound_media", {
      p_message_id: messageId, p_storage_bucket: "gril-media", p_storage_path: storagePath, p_mime_type: mimeType,
      p_size_bytes: downloaded.bytes.byteLength, p_sha256: sha256, p_extracted_text: extractedText ?? undefined,
    });
    if (completeError) throw completeError;
    return "completed";
  } catch (mediaError) {
    const retryable = mediaError instanceof RuntimeProviderError && mediaError.retryable || mediaError instanceof OpenAiRuntimeError && mediaError.retryable;
    if (retryable) throw mediaError;
    await admin.rpc("complete_inbound_media", {
      p_message_id: messageId, p_storage_bucket: "", p_storage_path: "", p_mime_type: claim.mime_type ?? "application/octet-stream",
      p_size_bytes: 0, p_sha256: "0".repeat(64),
      p_error_redacted: mediaError instanceof RuntimeProviderError || mediaError instanceof OpenAiRuntimeError
        ? mediaError.redactedMessage : "A mídia foi recebida, mas não pôde ser processada com segurança.",
    });
    return "failed";
  }
}

async function processRegressionCase(runId: string, caseId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_regression_case", { p_run_id: runId, p_case_id: caseId });
  if (error) throw error;
  const claim = regressionClaimSchema.parse(data);
  if (claim.status !== "claimed") return claim.status;
  if (!claim.result_id || !claim.integration_account_id || !claim.input || !claim.model || !claim.allowed_actions || !claim.prohibited_actions) {
    throw new Error("regression_context_missing");
  }
  try {
    const { data: apiKey, error: secretError } = await admin.rpc("get_integration_secret", { p_integration_account_id: claim.integration_account_id });
    if (secretError || !apiKey) throw secretError ?? new Error("regression_secret_missing");
    const evaluation = await evaluateRegressionCase({
      apiKey, model: claim.model, simulatedInput: claim.input, initialState: claim.initial_state ?? {},
      expectedResponse: claim.expected_response ?? null, rubric: claim.rubric ?? {}, allowedActions: claim.allowed_actions,
      prohibitedActions: claim.prohibited_actions, rules: claim.rules ?? {},
    });
    const { error: completeError } = await admin.rpc("complete_regression_case", {
      p_result_id: claim.result_id, p_actual_action: evaluation.actual_action, p_output_text: evaluation.response,
      p_output_structured: evaluation as unknown as Json, p_violations: evaluation.triggered_prohibitions,
    });
    if (completeError) throw completeError;
    return evaluation.passed ? "passed" : "failed";
  } catch (regressionError) {
    if (regressionError instanceof OpenAiRuntimeError && regressionError.retryable) throw regressionError;
    await admin.rpc("complete_regression_case", {
      p_result_id: claim.result_id, p_actual_action: "error", p_output_text: "", p_output_structured: {}, p_violations: [],
      p_error_redacted: regressionError instanceof OpenAiRuntimeError ? regressionError.redactedMessage : "O caso de regressão falhou antes da avaliação.",
    });
    return "error";
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
  let outboundBody = claim.body;
  let callContext: { id: string; format: string; video_link: string | null; starts_at: string; org_id: string; operation_id: string; status: string } | null = null;
  const [{ data: conversationMessage }, { data: operationalMessage }] = await Promise.all([
    admin.from("messages").select("content_type,metadata").eq("id", messageId).maybeSingle(),
    admin.from("operational_messages").select("entity_type,entity_id").eq("id", messageId).maybeSingle(),
  ]);
  const metadata = conversationMessage?.metadata && typeof conversationMessage.metadata === "object" && !Array.isArray(conversationMessage.metadata)
    ? conversationMessage.metadata as Record<string, unknown> : null;
  const callId = z.string().uuid().safeParse(
    metadata?.call_id ?? (operationalMessage?.entity_type === "call" ? operationalMessage.entity_id : null),
  );
  if (callId.success) {
    const { data: relatedCall } = await admin.from("calls")
      .select("id,format,video_link,starts_at,org_id,operation_id,status").eq("id", callId.data).maybeSingle();
    callContext = relatedCall;
    if (callContext?.format === "video") {
      if (callContext.video_link && !outboundBody.includes(callContext.video_link)) {
        outboundBody = `${outboundBody}\n\nLink: ${callContext.video_link}`;
      } else if (!callContext.video_link && new Date(callContext.starts_at).valueOf() - Date.now() <= 15 * 60_000) {
        await admin.from("alerts").insert({
          org_id: callContext.org_id, operation_id: callContext.operation_id, severity: "critical", category: "call",
          title: "Videochamada sem link", body: "A call começa em até 15 minutos e ainda não possui um link HTTPS configurado.",
          entity_type: "call", entity_id: callContext.id, dedupe_key: `call-video-link-missing:${callContext.id}`,
        });
      }
    }
  }
  try {
    const isApprovedMedia = conversationMessage?.content_type === "image" || conversationMessage?.content_type === "document";
    let template: { name: string; language: string; parameters: string[] } | null = null;
    if (claim.provider === "meta_cloud") {
      const { data: templateData, error: templateError } = await admin.rpc("get_outbound_template", { p_message_id: messageId });
      if (templateError) throw templateError;
      const parsedTemplate = outboundTemplateSchema.parse(templateData);
      if (isApprovedMedia && parsedTemplate.required) {
        await admin.rpc("block_outbound_template_missing", { p_message_id: messageId });
        return "suppressed";
      }
      if (parsedTemplate.required && (parsedTemplate.missing || !parsedTemplate.name || !parsedTemplate.language)) {
        await admin.rpc("block_outbound_template_missing", { p_message_id: messageId });
        return "suppressed";
      }
      if (parsedTemplate.name && parsedTemplate.language) template = {
        name: parsedTemplate.name, language: parsedTemplate.language, parameters: parsedTemplate.parameters,
      };
      if (template && callContext?.format === "video") {
        if (parsedTemplate.strategy === "call_link" && callContext.video_link) template.parameters = [callContext.video_link];
        if (parsedTemplate.strategy === "body") template.parameters = [outboundBody.slice(0, 1024)];
        if (parsedTemplate.strategy === "call_link" && !callContext.video_link) {
          await admin.rpc("fail_outbound_message", {
            p_error_code: "call_video_link_missing",
            p_error_redacted: "A videochamada ainda não possui link HTTPS configurado.",
            p_message_id: messageId,
          });
          return "failed";
        }
      }
    }
    let sent: { providerMessageId: string; providerTimestamp: string };
    if (isApprovedMedia) {
      const storagePath = typeof metadata?.storage_path === "string" ? metadata.storage_path : null;
      const storageBucket = typeof metadata?.storage_bucket === "string" ? metadata.storage_bucket : null;
      const mimeType = typeof metadata?.mime_type === "string" ? metadata.mime_type : null;
      if (!storagePath || storageBucket !== "gril-projects" || !mimeType) {
        throw new RuntimeProviderError("approved_media_context_missing", "A mídia aprovada perdeu a referência privada de armazenamento.");
      }
      const { data: signed, error: signedError } = await admin.storage.from(storageBucket).createSignedUrl(storagePath, 15 * 60);
      if (signedError || !signed?.signedUrl) throw signedError ?? new Error("approved_media_signed_url_failed");
      sent = await sendWhatsappMedia({
        provider: claim.provider as WhatsappProvider,
        endpointUrl: claim.endpoint_url,
        secret,
        externalPhoneNumberId: account.external_phone_number_id,
        toE164: claim.to_e164,
        caption: outboundBody,
        messageId,
        mediaType: conversationMessage!.content_type as "image" | "document",
        mediaUrl: signed.signedUrl,
        mimeType,
        fileName: typeof metadata?.file_name === "string" ? metadata.file_name : undefined,
      });
    } else {
      sent = await sendWhatsappText({
        provider: claim.provider as WhatsappProvider,
        endpointUrl: claim.endpoint_url,
        secret,
        externalPhoneNumberId: account.external_phone_number_id,
        toE164: claim.to_e164,
        body: outboundBody,
        messageId,
        template,
      });
    }
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
  if (result.status === "run_ai" && result.ai_execution_id) {
    await runAiExecution(result.ai_execution_id);
    await admin.rpc("finish_runtime_job", { p_error_redacted: undefined, p_job_id: jobId, p_retry_seconds: 30, p_success: true });
    return;
  }
  if (result.status === "process_media" && result.message_id) {
    await processInboundMedia(result.message_id);
    await admin.rpc("finish_runtime_job", { p_error_redacted: undefined, p_job_id: jobId, p_retry_seconds: 60, p_success: true });
    return;
  }
  if (result.status === "run_regression" && result.run_id && result.case_id) {
    await processRegressionCase(result.run_id, result.case_id);
    await admin.rpc("finish_runtime_job", { p_error_redacted: undefined, p_job_id: jobId, p_retry_seconds: 60, p_success: true });
    return;
  }
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

async function deliverPendingPushNotifications() {
  const publicKey=process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;const privateKey=process.env.WEB_PUSH_PRIVATE_KEY;
  if(!publicKey||!privateKey)return;
  webpush.setVapidDetails(process.env.WEB_PUSH_SUBJECT??"mailto:suporte@gril.app",publicKey,privateKey);
  const admin=createAdminClient();
  const{data:notifications,error}=await admin.from("notifications").select("id,title,body,recipient_membership_id,memberships!inner(user_id)").eq("channel","push").eq("status","pending").order("created_at").limit(20);
  if(error)throw error;
  for(const notification of notifications??[]){
    const membership=Array.isArray(notification.memberships)?notification.memberships[0]:notification.memberships;
    if(!membership?.user_id){await admin.from("notifications").update({status:"failed"}).eq("id",notification.id);continue;}
    const{subscriptions}=await (async()=>{const result=await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth_key").eq("user_id",membership.user_id).is("revoked_at",null);return{subscriptions:result.data??[]};})();
    if(!subscriptions.length){await admin.from("notifications").update({status:"cancelled"}).eq("id",notification.id);continue;}
    let delivered=false;
    for(const subscription of subscriptions){
      try{
        await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth_key}},JSON.stringify({title:notification.title,body:notification.body,url:"/app/central",tag:`gril-${notification.id}`}));
        delivered=true;await admin.from("push_subscriptions").update({last_success_at:new Date().toISOString(),last_error_redacted:null}).eq("id",subscription.id);
      }catch(pushError){
        const statusCode=(pushError as{statusCode?:number}).statusCode;await admin.from("push_subscriptions").update({revoked_at:[404,410].includes(statusCode??0)?new Date().toISOString():null,last_error_redacted:`push_http_${statusCode??"error"}`}).eq("id",subscription.id);
      }
    }
    await admin.from("notifications").update(delivered?{status:"sent",sent_at:new Date().toISOString()}:{status:"failed"}).eq("id",notification.id).eq("status","pending");
  }
}

async function deliverPendingPlatformPushNotifications() {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  if (!publicKey || !privateKey) return 0;
  webpush.setVapidDetails(process.env.WEB_PUSH_SUBJECT ?? "mailto:suporte@gril.app", publicKey, privateKey);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_platform_push_notifications", { p_limit: 20 });
  if (error) throw error;
  const notifications = platformPushClaimSchema.parse(data);
  let deliveredCount = 0;
  for (const notification of notifications) {
    let deliveredSubscriptionId: string | undefined;
    let failedSubscriptionId: string | undefined;
    let revokeFailedSubscription = false;
    for (const subscription of notification.subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } },
          JSON.stringify({ title: notification.title, body: notification.body, url: notification.url, tag: `gril-platform-${notification.id}` }),
        );
        deliveredSubscriptionId = subscription.id;
        break;
      } catch (pushError) {
        const statusCode = (pushError as { statusCode?: number }).statusCode;
        failedSubscriptionId = subscription.id;
        revokeFailedSubscription = [404, 410].includes(statusCode ?? 0);
      }
    }
    const delivered = Boolean(deliveredSubscriptionId);
    await admin.rpc("finish_platform_push_notification", {
      p_notification_id: notification.id,
      p_delivered: delivered,
      p_subscription_id: deliveredSubscriptionId ?? failedSubscriptionId,
      p_revoke_subscription: !delivered && revokeFailedSubscription,
    });
    if (delivered) deliveredCount += 1;
  }
  return deliveredCount;
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
  if(queue==="notifications")await deliverPendingPushNotifications();
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
        await admin.rpc("runtime_queue_dead_letter", {
          p_error_code: itemError instanceof Error ? itemError.name : "runtime_queue_error",
          p_error_redacted: itemError instanceof Error ? itemError.message.slice(0, 500) : "Falha definitiva no processamento da fila.",
          p_msg_id: item.msg_id,
          p_payload: item.message as Json,
          p_queue_name: queue,
          p_read_count: item.read_ct,
        });
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
    // Each pass consumes at most five items per queue. Keep the producer batch
    // bounded to the same size so jobs are not leased faster than this worker
    // can make them visible again or finish them.
    const { error: dispatchError } = await admin.rpc("dispatch_runtime_sources", { p_batch_size: 5 });
    if (dispatchError) throw dispatchError;
    for (const queue of queueNames) {
      const result = await drainQueue(queue);
      const previous = summary[queue] ?? { completed: 0, retried: 0 };
      summary[queue] = { completed: previous.completed + result.completed, retried: previous.retried + result.retried };
    }
  }
  const purged = await drainRetention();
  const platformPushDelivered = await deliverPendingPlatformPushNotifications();
  await admin.from("integration_health_checks").insert({
    component: "queues",
    status: "healthy",
    metadata: { source: "runtime_worker", summary, purged, platformPushDelivered },
  });
  return { ok: true, summary, purged, platformPushDelivered };
}
