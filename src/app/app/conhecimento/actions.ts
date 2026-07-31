"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const projectSchema = z.object({
  name: z.string().trim().min(2).max(160),
  region: z.string().trim().min(2).max(160),
  neighborhood: z.string().trim().max(160).optional(),
  summary: z.string().trim().min(20).max(4000),
  deliveryType: z.enum(["ready", "under_construction", "launch", "mixed"]),
  minPrice: z.coerce.number().nonnegative(),
  maxPrice: z.coerce.number().nonnegative(),
  minDownPayment: z.coerce.number().nonnegative(),
  sourceName: z.string().trim().min(2).max(160),
  validUntil: z.string().date(),
  coverStoragePath: z.string().trim().min(3).max(500),
  activate: z.boolean(),
});

export async function createProjectAction(formData: FormData) {
  const parsed = projectSchema.safeParse({
    name: formData.get("name"), region: formData.get("region"), neighborhood: formData.get("neighborhood") || undefined,
    summary: formData.get("summary"), deliveryType: formData.get("deliveryType"), minPrice: formData.get("minPrice"),
    maxPrice: formData.get("maxPrice"), minDownPayment: formData.get("minDownPayment"), sourceName: formData.get("sourceName"),
    validUntil: formData.get("validUntil"), coverStoragePath: formData.get("coverStoragePath"), activate: formData.get("activate") === "on",
  });
  if (!parsed.success) {
    redirect(`/app/conhecimento?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Revise os campos.")}`);
  }
  if (parsed.data.maxPrice < parsed.data.minPrice) {
    redirect(`/app/conhecimento?erro=${encodeURIComponent("Preço máximo deve ser maior que o mínimo.")}`);
  }
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const operation = viewer.operations.find((item) => item.is_default) ?? viewer.operations[0];
  const { error } = await supabase.from("projects").insert({
    org_id: viewer.organization!.id,
    operation_id: operation?.id ?? null,
    name: parsed.data.name,
    region: parsed.data.region,
    neighborhood: parsed.data.neighborhood || null,
    summary: parsed.data.summary,
    delivery_type: parsed.data.deliveryType,
    min_price: parsed.data.minPrice,
    max_price: parsed.data.maxPrice,
    min_down_payment: parsed.data.minDownPayment,
    source_name: parsed.data.sourceName,
    reference_date: new Date().toISOString().slice(0, 10),
    valid_until: parsed.data.validUntil,
    cover_storage_path: parsed.data.coverStoragePath,
    status: parsed.data.activate ? "active" : "draft",
    recommendable: parsed.data.activate,
    created_by: viewer.userId,
  });
  if (error) redirect(`/app/conhecimento?erro=${encodeURIComponent("Não foi possível salvar o empreendimento.")}`);
  revalidatePath("/app/conhecimento");
  redirect("/app/conhecimento?sucesso=empreendimento-criado");
}

export async function createFaqAction(formData: FormData) {
  const parsed = z.object({
    question: z.string().trim().min(5).max(500),
    answer: z.string().trim().min(10).max(4000),
    responseMode: z.enum(["direct", "brief_then_call", "silent_escalation"]),
    sourceName: z.string().trim().min(2).max(160),
  }).safeParse({ question: formData.get("question"), answer: formData.get("answer"), responseMode: formData.get("responseMode"), sourceName: formData.get("sourceName") });
  if (!parsed.success) {
    redirect(`/app/conhecimento?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Revise a FAQ.")}`);
  }
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { error } = await supabase.from("faq_creation_requests").insert({
    org_id: viewer.organization!.id,
    canonical_question: parsed.data.question,
    base_answer: parsed.data.answer,
    response_mode: parsed.data.responseMode,
    source_name: parsed.data.sourceName,
    actor_user_id: viewer.userId,
  });
  if (error) redirect(`/app/conhecimento?erro=${encodeURIComponent("Não foi possível publicar a FAQ.")}`);
  revalidatePath("/app/conhecimento");
  redirect("/app/conhecimento?sucesso=faq-publicada");
}
