"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireActiveViewer } from "@/lib/auth/session";
import { createInternalAssistantResponse } from "@/lib/integrations/internal-assistant";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const sendSchema = z.object({
  threadId: z.string().uuid(),
  body: z.string().trim().min(1).max(12000),
  replyToMessageId: z.string().uuid().optional(),
});

function canManageAi(viewer: Awaited<ReturnType<typeof requireActiveViewer>>) {
  return viewer.membership?.role === "owner"
    || viewer.membership?.role === "manager"
    || viewer.permissions.includes("ai.manage")
    || viewer.supportAccess === "full";
}

export async function sendInternalMessageAction(formData: FormData) {
  const parsed = sendSchema.safeParse({
    threadId: formData.get("threadId"),
    body: formData.get("body"),
    replyToMessageId: formData.get("replyToMessageId") || undefined,
  });
  if (!parsed.success) return;

  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { data: thread, error: threadError } = await supabase
    .from("internal_threads")
    .select("*")
    .eq("id", parsed.data.threadId)
    .maybeSingle();
  if (threadError || !thread || thread.org_id !== viewer.organization!.id) return;
  if (thread.thread_type !== "broker_assistant" && !canManageAi(viewer)) return;

  const { error: insertError } = await supabase.from("internal_messages").insert({
    org_id: thread.org_id,
    thread_id: thread.id,
    actor_kind: "user",
    actor_user_id: viewer.userId,
    reply_to_message_id: parsed.data.replyToMessageId ?? null,
    body: parsed.data.body,
  });
  if (insertError) return;

  const admin = createAdminClient();
  const [messagesResult, modelResult, conversationResult] = await Promise.all([
    admin.from("internal_messages")
      .select("actor_kind,body,created_at")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: false })
      .limit(40),
    admin.from("model_profiles")
      .select("model_identifier,reasoning_effort,text_verbosity,integration_account_id")
      .eq("org_id", thread.org_id)
      .eq("status", "active")
      .eq("is_default", true)
      .maybeSingle(),
    thread.conversation_id
      ? admin.from("conversations")
        .select("id,status,ownership,ai_mode,version,last_message_preview,contacts(name),opportunities(id,pipeline_stages(name))")
        .eq("id", thread.conversation_id)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const model = modelResult.data;
  if (!model?.integration_account_id) {
    await admin.from("internal_messages").insert({
      org_id: thread.org_id,
      thread_id: thread.id,
      actor_kind: thread.assistant_role,
      message_kind: "action_result",
      body: "Não consigo responder ainda porque a organização não possui um modelo OpenAI ativo.",
      metadata: { error: "openai_model_missing" },
    });
    revalidatePath("/app", "layout");
    return;
  }
  const { data: apiKey } = await admin.rpc("get_integration_secret", {
    p_integration_account_id: model.integration_account_id,
  });
  if (!apiKey) return;

  const history = [...(messagesResult.data ?? [])].reverse().map((message) => ({
    role: message.actor_kind === "user" ? "user" as const : "assistant" as const,
    text: message.body,
  }));
  const whatsappMessages = thread.conversation_id
    ? (await admin.from("messages")
      .select("direction,sender_type,body,content_type,created_at,metadata")
      .eq("conversation_id", thread.conversation_id)
      .order("created_at", { ascending: false })
      .limit(40)).data ?? []
    : [];

  try {
    const response = await createInternalAssistantResponse({
      apiKey,
      model: model.model_identifier,
      reasoningEffort: model.reasoning_effort,
      textVerbosity: model.text_verbosity,
      assistant: thread.assistant_role === "lionel" ? "lionel" : "pedro",
      messages: history,
      context: {
        thread: {
          title: thread.title,
          type: thread.thread_type,
          status: thread.status,
          priority: thread.priority,
          source: thread.source,
          metadata: thread.metadata,
        },
        conversation: conversationResult.data,
        whatsapp_history: [...whatsappMessages].reverse(),
        constraints: {
          explicit_confirmation_required: true,
          may_send_whatsapp_directly: false,
          broker_assistant_is_advisory_only: thread.thread_type === "broker_assistant",
        },
      },
    });
    await admin.from("internal_messages").insert({
      org_id: thread.org_id,
      thread_id: thread.id,
      actor_kind: thread.assistant_role,
      body: response.text,
      metadata: {
        response_id: response.responseId,
        model: model.model_identifier,
        input_tokens: response.inputTokens,
        output_tokens: response.outputTokens,
      },
    });
    await admin.from("internal_threads").update({
      status: thread.assistant_role === "lionel" ? "discussing" : "awaiting_response",
      requires_action: thread.assistant_role === "pedro",
    }).eq("id", thread.id);
  } catch (error) {
    await admin.from("internal_messages").insert({
      org_id: thread.org_id,
      thread_id: thread.id,
      actor_kind: thread.assistant_role,
      message_kind: "action_result",
      body: "Não consegui concluir esta análise agora. O tópico foi preservado para nova tentativa.",
      metadata: { error: error instanceof Error ? error.name : "internal_ai_error" },
    });
  }

  await supabase.rpc("mark_internal_thread_read", { p_thread_id: thread.id });
  revalidatePath("/app", "layout");
  revalidatePath("/app/chat-pedro");
  revalidatePath("/app/lionel");
  revalidatePath("/app/assistente-corretor");
}

export async function markInternalThreadReadAction(threadId: string) {
  const parsed = z.string().uuid().safeParse(threadId);
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.rpc("mark_internal_thread_read", { p_thread_id: parsed.data });
  revalidatePath("/app", "layout");
}

export async function createLearningCandidateAction(formData: FormData) {
  const threadId = z.string().uuid().safeParse(formData.get("threadId"));
  if (!threadId.success) return;
  const viewer = await requireActiveViewer();
  if (!canManageAi(viewer)) return;
  const supabase = await createClient();
  const { data: thread } = await supabase.from("internal_threads").select("*").eq("id", threadId.data).maybeSingle();
  if (!thread || thread.org_id !== viewer.organization!.id || thread.assistant_role !== "lionel") return;
  const { data: messages } = await supabase.from("internal_messages")
    .select("actor_kind,body,created_at")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const transcript = [...(messages ?? [])].reverse().map((message) => `${message.actor_kind}: ${message.body}`).join("\n");
  if (transcript.trim().length < 5) return;
  const { error } = await supabase.from("learning_suggestions").insert({
    org_id: thread.org_id,
    operation_id: thread.operation_id,
    conversation_id: thread.conversation_id,
    source: "lionel",
    human_observation: `Curadoria conduzida no tópico: ${thread.title}`,
    suggested_change: transcript.slice(0, 4000),
    scope: "rule",
    candidate_kind: "potential_rule",
    source_thread_id: thread.id,
    evidence: [{ thread_id: thread.id, collected_at: new Date().toISOString() }],
    created_by: viewer.userId,
  });
  if (!error) {
    await supabase.from("internal_threads").update({ status: "awaiting_confirmation", requires_action: true }).eq("id", thread.id);
  }
  revalidatePath("/app/lionel");
  revalidatePath("/app/aprendizados");
}

export async function startBrokerConsultationAction(formData: FormData) {
  const conversationId = z.string().uuid().safeParse(formData.get("conversationId"));
  if (!conversationId.success) return;
  const viewer = await requireActiveViewer();
  if (viewer.membership?.role !== "broker") return;
  const supabase = await createClient();
  const { data: conversation } = await supabase.from("conversations")
    .select("id,org_id,operation_id,opportunity_id,contacts(name)")
    .eq("id", conversationId.data)
    .maybeSingle();
  if (!conversation || conversation.org_id !== viewer.organization!.id) return;
  const existing = await supabase.from("internal_threads").select("id")
    .eq("conversation_id", conversation.id)
    .eq("broker_membership_id", viewer.membership.id)
    .eq("thread_type", "broker_assistant")
    .neq("status", "archived")
    .maybeSingle();
  let threadId = existing.data?.id;
  if (!threadId) {
    const contact = Array.isArray(conversation.contacts) ? conversation.contacts[0] : conversation.contacts;
    const { data: thread, error } = await supabase.from("internal_threads").insert({
      org_id: conversation.org_id,
      operation_id: conversation.operation_id,
      assistant_role: "pedro",
      thread_type: "broker_assistant",
      title: `Ajuda com ${contact?.name ?? "o lead"}`,
      conversation_id: conversation.id,
      opportunity_id: conversation.opportunity_id,
      broker_membership_id: viewer.membership.id,
      status: "discussing",
      priority: "normal",
      source: "manual",
      created_by: viewer.userId,
    }).select("id").single();
    if (error || !thread) return;
    threadId = thread.id;
    const admin = createAdminClient();
    await admin.from("internal_messages").insert({
      org_id: conversation.org_id,
      thread_id: thread.id,
      actor_kind: "pedro",
      body: "Estou com o contexto desta conversa aberto. Qual dúvida você precisa resolver para responder ao lead?",
      metadata: { conversation_id: conversation.id, advisory_only: true },
    });
  }
  redirect(`/app/assistente-corretor?topico=${threadId}`);
}

export async function resolveExternalInterventionAction(formData: FormData) {
  const parsed = z.object({
    threadId: z.string().uuid(),
    decision: z.enum(["continue_human", "return_to_pedro", "unrecognized"]),
  }).safeParse({ threadId: formData.get("threadId"), decision: formData.get("decision") });
  if (!parsed.success) return;
  const viewer = await requireActiveViewer();
  if (!canManageAi(viewer)) return;
  const supabase = await createClient();
  const { data: thread } = await supabase.from("internal_threads").select("*").eq("id", parsed.data.threadId).maybeSingle();
  if (!thread?.conversation_id || thread.source !== "external_device" || thread.org_id !== viewer.organization!.id) return;
  const admin = createAdminClient();
  const { data: conversation } = await admin.from("conversations").select("*").eq("id", thread.conversation_id).single();
  if (!conversation) return;

  let resultText = "";
  if (parsed.data.decision === "continue_human") {
    await admin.from("conversations").update({ ownership: "human", ai_mode: "off", status: "active", pause_reason: null, version: conversation.version + 1 }).eq("id", conversation.id);
    resultText = "Atendimento mantido com a equipe humana. Pedro continuará sem enviar mensagens.";
  } else if (parsed.data.decision === "unrecognized") {
    if (conversation.connection_id) {
      await admin.from("whatsapp_connections").update({
        outbound_paused: true,
        outbound_pause_reason: "Envio pelo celular não reconhecido pelo gestor",
        outbound_paused_at: new Date().toISOString(),
      }).eq("id", conversation.connection_id);
    }
    await admin.from("conversations").update({ ownership: "human", ai_mode: "off", status: "paused", pause_reason: "unrecognized_device_send", version: conversation.version + 1 }).eq("id", conversation.id);
    resultText = "Envios desta conexão pausados. O inbound continua disponível para investigação e a retomada exigirá teste e confirmação do dono.";
  } else {
    const { data: settings } = await admin.from("organization_settings").select("inbound_ai_mode").eq("org_id", thread.org_id).single();
    if (!settings || settings.inbound_ai_mode === "off") {
      resultText = "Não devolvi a conversa: o modo inbound do Pedro está desligado.";
    } else {
      await admin.from("conversations").update({
        ownership: "ai",
        ai_mode: settings.inbound_ai_mode,
        status: "active",
        pause_reason: null,
        autonomy_override: "low",
        version: conversation.version + 1,
      }).eq("id", conversation.id);
      const { data: latestInbound } = await admin.from("messages").select("id").eq("conversation_id", conversation.id).eq("direction", "inbound").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (latestInbound) await admin.rpc("ensure_inbound_ai_execution", { p_message_id: latestInbound.id });
      resultText = "Conversa devolvida ao Pedro em autonomia baixa. Ele reavaliará a última mensagem com todo o contexto.";
    }
  }
  await admin.from("internal_messages").insert({
    org_id: thread.org_id,
    thread_id: thread.id,
    actor_kind: "system",
    message_kind: "decision",
    body: resultText,
    metadata: { decision: parsed.data.decision, decided_by: viewer.userId },
  });
  await admin.from("internal_threads").update({ status: "resolved", requires_action: false, resolved_at: new Date().toISOString() }).eq("id", thread.id);
  revalidatePath("/app/chat-pedro");
  revalidatePath("/app/inbox");
  revalidatePath("/app", "layout");
}
