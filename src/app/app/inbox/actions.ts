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
  return "Não foi possível concluir a ação.";
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
}

