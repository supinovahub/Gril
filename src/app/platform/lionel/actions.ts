"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireViewer } from "@/lib/auth/session";
import { createInternalAssistantResponse } from "@/lib/integrations/internal-assistant";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function sendPlatformLionelMessageAction(formData: FormData) {
  const parsed = z.object({ threadId: z.string().uuid(), body: z.string().trim().min(1).max(12000) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const viewer = await requireViewer();
  if (viewer.platformRole !== "platform_admin") return;
  const supabase = await createClient();
  const { data: thread } = await supabase.from("platform_internal_threads").select("id,title,thread_type,status,metadata").eq("id", parsed.data.threadId).maybeSingle();
  if (!thread) return;
  const { error } = await supabase.from("platform_internal_messages").insert({ thread_id: thread.id, actor_kind: "user", actor_user_id: viewer.userId, body: parsed.data.body });
  if (error) return;
  const admin = createAdminClient();
  const { data: messages } = await admin.from("platform_internal_messages").select("actor_kind,body").eq("thread_id", thread.id).order("created_at").limit(50);
  const apiKey = process.env.PLATFORM_OPENAI_API_KEY;
  if (!apiKey) {
    await admin.from("platform_internal_messages").insert({
      thread_id: thread.id,
      actor_kind: "lionel",
      body: "A curadoria foi registrada, mas o Lionel da plataforma está sem uma credencial OpenAI própria. Nenhuma chave de imobiliária foi usada como fallback.",
      metadata: { error: "platform_openai_key_missing" },
    });
  } else {
    const response = await createInternalAssistantResponse({
      apiKey,
      model: process.env.PLATFORM_OPENAI_MODEL ?? "gpt-5.6-terra",
      assistant: "lionel",
      messages: (messages ?? []).map((message) => ({ role: message.actor_kind === "user" ? "user" as const : "assistant" as const, text: message.body })),
      context: { scope: "platform", tenant_content_allowed: false, thread },
    });
    await admin.from("platform_internal_messages").insert({ thread_id: thread.id, actor_kind: "lionel", body: response.text, metadata: { response_id: response.responseId } });
  }
  revalidatePath("/platform/lionel");
}
