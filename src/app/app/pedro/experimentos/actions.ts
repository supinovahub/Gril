"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function createExperimentAction(formData: FormData) {
  const parsed = z.object({ name: z.string().trim().min(3).max(160), scope: z.enum(["campaign", "eligible_inbound"]), operationId: z.string().uuid(), personaA: z.string().uuid(), personaB: z.string().uuid(), ruleVersionId: z.string().uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/app/pedro/experimentos?erro=revise-o-experimento");
  const viewer = await requireActiveViewer(); const supabase = await createClient();
  const { data: experiment, error } = await supabase.from("experiments").insert({ org_id: viewer.organization!.id, operation_id: parsed.data.operationId, name: parsed.data.name, scope: parsed.data.scope, created_by: viewer.userId }).select("id").single();
  if (error) redirect("/app/pedro/experimentos?erro=experimento-nao-criado");
  const { error: variantsError } = await supabase.from("experiment_variants").insert([
    { org_id: viewer.organization!.id, experiment_id: experiment.id, name: "A", allocation_percent: 50, persona_version_id: parsed.data.personaA, rule_version_id: parsed.data.ruleVersionId },
    { org_id: viewer.organization!.id, experiment_id: experiment.id, name: "B", allocation_percent: 50, persona_version_id: parsed.data.personaB, rule_version_id: parsed.data.ruleVersionId },
  ]);
  if (variantsError) redirect("/app/pedro/experimentos?erro=variantes-nao-criadas");
  revalidatePath("/app/pedro/experimentos"); redirect("/app/pedro/experimentos?sucesso=rascunho-criado");
}

export async function transitionExperimentAction(formData: FormData) {
  const parsed = z.object({ experimentId: z.string().uuid(), action: z.enum(["start", "pause", "resume", "complete", "cancel", "promote_winner"]), winnerVariantId: z.string().uuid().optional(), reason: z.string().trim().max(1000).optional() }).safeParse({ experimentId: formData.get("experimentId"), action: formData.get("action"), winnerVariantId: formData.get("winnerVariantId") || undefined, reason: formData.get("reason") || undefined });
  if (!parsed.success) redirect("/app/pedro/experimentos?erro=transicao-invalida");
  const viewer = await requireActiveViewer(); const supabase = await createClient();
  const { error } = await supabase.from("experiment_transition_requests").insert({ org_id: viewer.organization!.id, experiment_id: parsed.data.experimentId, action: parsed.data.action, winner_variant_id: parsed.data.winnerVariantId ?? null, reason: parsed.data.reason ?? null, actor_user_id: viewer.userId });
  if (error) redirect(`/app/pedro/experimentos?erro=${encodeURIComponent("A transição foi recusada por papel, estado ou configuração das variantes.")}`);
  revalidatePath("/app/pedro/experimentos"); redirect("/app/pedro/experimentos?sucesso=transicao-aplicada");
}
