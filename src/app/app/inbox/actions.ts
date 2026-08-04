"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const sendSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1).max(4096),
  expectedVersion: z.coerce.number().int().positive(),
});

const conversationActionSchema = z.object({
  conversationId: z.string().uuid(),
  action: z.enum(["take_over", "return_to_ai", "pause", "close"]),
  reason: z.string().trim().max(500).optional(),
  expectedVersion: z.coerce.number().int().positive(),
});

function errorText(message: string | undefined) {
  if (message?.includes("version_conflict")) return "A conversa mudou. Recarregue antes de tentar novamente.";
  if (message?.includes("opted_out")) return "O contato pediu opt-out e não pode receber mensagens.";
  if (message?.includes("suppressed")) return "O telefone está na lista de supressão.";
  if (message?.includes("not_active")) return "A conversa não está ativa.";
  if (message?.includes("connection_inactive")) return "A conexão desta conversa está inativa. Reconecte o WhatsApp antes de enviar.";
  if (message?.includes("ai_global_mode_off")) return "Ative o Pedro antes de devolver esta conversa para a IA.";
  return "Não foi possível concluir a ação.";
}

export async function markConversationReadAction(conversationId: string) {
  const parsedConversationId = z.string().uuid().safeParse(conversationId);
  if (!parsedConversationId.success) return false;

  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const [conversationResult, latestInboundResult] = await Promise.all([
    supabase
      .from("conversations")
      .select("id,org_id")
      .eq("id", parsedConversationId.data)
      .maybeSingle(),
    supabase
      .from("messages")
      .select("created_at")
      .eq("conversation_id", parsedConversationId.data)
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const conversation = conversationResult.data;
  const latestInbound = latestInboundResult.data;
  if (
    conversationResult.error
    || latestInboundResult.error
    || !conversation
    || conversation.org_id !== viewer.organization!.id
    || !latestInbound
  ) {
    return false;
  }

  const { error } = await supabase.from("conversation_read_states").upsert({
    org_id: conversation.org_id,
    conversation_id: conversation.id,
    user_id: viewer.userId,
    last_read_inbound_at: latestInbound.created_at,
  }, { onConflict: "conversation_id,user_id" });

  if (error) {
    console.error("Failed to mark Inbox conversation as read", error);
    return false;
  }

  revalidatePath("/app", "layout");
  revalidatePath("/app/inbox");
  return true;
}

export async function sendHumanMessageAction(formData: FormData) {
  const parsed = sendSchema.safeParse({
    conversationId: formData.get("conversationId"),
    body: formData.get("body"),
    expectedVersion: formData.get("expectedVersion"),
  });
  if (!parsed.success) return;

  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id,org_id")
    .eq("id", parsed.data.conversationId)
    .maybeSingle();
  if (!conversation || conversation.org_id !== viewer.organization!.id) return;

  const { error } = await supabase.from("message_send_requests").insert({
    org_id: conversation.org_id,
    conversation_id: conversation.id,
    actor_user_id: viewer.userId,
    body: parsed.data.body,
    expected_conversation_version: parsed.data.expectedVersion,
  });
  if (error) {
    redirect(`/app/inbox/${conversation.id}?erro=${encodeURIComponent(errorText(error.message))}`);
  }

  revalidatePath(`/app/inbox/${conversation.id}`);
  revalidatePath("/app/inbox");
  redirect(`/app/inbox/${conversation.id}?sucesso=mensagem-enfileirada`);
}

export async function conversationAction(formData: FormData) {
  const parsed = conversationActionSchema.safeParse({
    conversationId: formData.get("conversationId"),
    action: formData.get("action"),
    reason: formData.get("reason") || undefined,
    expectedVersion: formData.get("expectedVersion"),
  });
  if (!parsed.success) return;

  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id,org_id")
    .eq("id", parsed.data.conversationId)
    .maybeSingle();
  if (!conversation || conversation.org_id !== viewer.organization!.id) return;

  const { error } = await supabase.from("conversation_takeover_requests").insert({
    org_id: conversation.org_id,
    conversation_id: conversation.id,
    actor_user_id: viewer.userId,
    action: parsed.data.action,
    reason: parsed.data.reason || null,
    expected_version: parsed.data.expectedVersion,
  });
  if (error) {
    redirect(`/app/inbox/${conversation.id}?erro=${encodeURIComponent(errorText(error.message))}`);
  }
  revalidatePath(`/app/inbox/${conversation.id}`);
  revalidatePath("/app/inbox");
  if (parsed.data.action === "return_to_ai") {
    redirect(`/app/inbox/${conversation.id}?sucesso=pedro-reprocessado`);
  }
}

export async function reviewAiSuggestionAction(formData: FormData) {
  const parsed = z.object({
    suggestionId: z.string().uuid(), conversationId: z.string().uuid(),
    action: z.enum(["send", "discard"]), body: z.string().trim().max(4096).optional(),
    expectedVersion: z.coerce.number().int().positive(),
  }).refine((value) => value.action === "discard" || Boolean(value.body), { message: "A mensagem não pode ficar vazia." })
    .safeParse({
      suggestionId: formData.get("suggestionId"), conversationId: formData.get("conversationId"),
      action: formData.get("action"), body: formData.get("body") || undefined,
      expectedVersion: formData.get("expectedVersion"),
    });
  if (!parsed.success) return;
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { error } = await supabase.from("ai_suggestion_review_requests").insert({
    org_id: viewer.organization!.id, suggestion_id: parsed.data.suggestionId, action: parsed.data.action,
    edited_body: parsed.data.body ?? null, expected_conversation_version: parsed.data.expectedVersion,
    actor_user_id: viewer.userId,
  });
  if (error) {
    redirect(`/app/inbox/${parsed.data.conversationId}?erro=${encodeURIComponent(errorText(error.message))}`);
  }
  revalidatePath(`/app/inbox/${parsed.data.conversationId}`);
  revalidatePath("/app/inbox");
  redirect(`/app/inbox/${parsed.data.conversationId}?sucesso=sugestao-${parsed.data.action}`);
}

