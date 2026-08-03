"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireActiveViewer } from "@/lib/auth/session";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

const startConversationSchema = z.object({
  title: z.string().trim().min(2).max(160),
  input: z.string().trim().min(1).max(12000),
  initialState: z.string().trim().max(12000).optional(),
});

const continueConversationSchema = z.object({
  sessionId: z.string().uuid(),
  input: z.string().trim().min(1).max(12000),
});

const sessionStatusSchema = z.object({
  sessionId: z.string().uuid(),
  action: z.enum(["archive", "restore"]),
});

function simulationErrorSlug(message: string) {
  if (message.includes("simulator_turn_pending")) return "aguarde-resposta-atual";
  if (message.includes("simulator_session_archived")) return "conversa-arquivada";
  if (message.includes("simulator_session_not_found")) return "conversa-nao-encontrada";
  if (message.includes("active_model_and_secret_required")) return "configure-modelo-e-chave";
  return "nao-foi-possivel-executar";
}

function regressionErrorSlug(message: string) {
  if (message.includes("regression_run_already_active")) return "regressao-ja-em-execucao";
  if (message.includes("published_rule_required")) return "publique-regras-da-regressao";
  if (message.includes("active_model_required")) return "configure-modelo-e-chave";
  if (message.includes("regression_run_forbidden")) return "sem-permissao-para-regressao";
  return "regressao-indisponivel";
}

function parseInitialState(value: string | undefined) {
  if (!value) return {} as Json;
  try {
    return JSON.parse(value) as Json;
  } catch {
    redirect("/app/simulador?erro=estado-inicial-deve-ser-json");
  }
}

export async function startSimulationConversationAction(formData: FormData) {
  const parsed = startConversationSchema.safeParse({
    title: formData.get("title"),
    input: formData.get("input"),
    initialState: formData.get("initialState") || undefined,
  });
  if (!parsed.success) redirect("/app/simulador?erro=revise-o-cenario");

  const initialState = parseInitialState(parsed.data.initialState);
  const viewer = await requireActiveViewer();
  const operation = viewer.operations.find((item) => item.is_default) ?? viewer.operations[0];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("simulator_run_requests")
    .insert({
      org_id: viewer.organization!.id,
      operation_id: operation?.id ?? null,
      title: parsed.data.title,
      simulated_input: parsed.data.input,
      initial_state: initialState,
      actor_user_id: viewer.userId,
    })
    .select("session_id")
    .single();

  if (error || !data.session_id) {
    redirect(`/app/simulador?erro=${simulationErrorSlug(error?.message ?? "session_not_created")}`);
  }
  revalidatePath("/app/simulador");
  redirect(`/app/simulador?conversa=${data.session_id}&sucesso=conversa-iniciada`);
}

export async function continueSimulationConversationAction(formData: FormData) {
  const parsed = continueConversationSchema.safeParse({
    sessionId: formData.get("sessionId"),
    input: formData.get("input"),
  });
  if (!parsed.success) redirect("/app/simulador?erro=revise-a-mensagem");

  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { data: session, error: sessionError } = await supabase
    .from("simulator_sessions")
    .select("id,title,operation_id,initial_state,status")
    .eq("id", parsed.data.sessionId)
    .eq("org_id", viewer.organization!.id)
    .single();

  if (sessionError || !session) redirect("/app/simulador?erro=conversa-nao-encontrada");
  if (session.status !== "active") {
    redirect(`/app/simulador?conversa=${session.id}&erro=conversa-arquivada`);
  }

  const { error } = await supabase.from("simulator_run_requests").insert({
    org_id: viewer.organization!.id,
    operation_id: session.operation_id,
    session_id: session.id,
    title: session.title,
    simulated_input: parsed.data.input,
    initial_state: session.initial_state,
    actor_user_id: viewer.userId,
  });
  if (error) {
    redirect(`/app/simulador?conversa=${session.id}&erro=${simulationErrorSlug(error.message)}`);
  }

  revalidatePath("/app/simulador");
  redirect(`/app/simulador?conversa=${session.id}&sucesso=mensagem-enviada`);
}

export async function changeSimulationConversationStatusAction(formData: FormData) {
  const parsed = sessionStatusSchema.safeParse({
    sessionId: formData.get("sessionId"),
    action: formData.get("action"),
  });
  if (!parsed.success) redirect("/app/simulador?erro=acao-invalida");

  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { error } = await supabase.from("simulator_session_requests").insert({
    org_id: viewer.organization!.id,
    session_id: parsed.data.sessionId,
    action: parsed.data.action,
    actor_user_id: viewer.userId,
  });
  if (error) {
    redirect(`/app/simulador?conversa=${parsed.data.sessionId}&erro=${simulationErrorSlug(error.message)}`);
  }

  revalidatePath("/app/simulador");
  if (parsed.data.action === "archive") {
    redirect("/app/simulador?sucesso=conversa-arquivada");
  }
  redirect(`/app/simulador?conversa=${parsed.data.sessionId}&sucesso=conversa-restaurada`);
}

export async function runRegressionAction() {
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { error } = await supabase.from("regression_run_requests").insert({
    org_id: viewer.organization!.id,
    actor_user_id: viewer.userId,
  });
  if (error) {
    redirect(`/app/simulador?erro=${regressionErrorSlug(error.message)}`);
  }
  revalidatePath("/app/simulador");
  redirect("/app/simulador?sucesso=regressao-iniciada");
}
