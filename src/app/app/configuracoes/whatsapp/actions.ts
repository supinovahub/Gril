"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireActiveViewer } from "@/lib/auth/session";
import { normalizePhoneToE164 } from "@/lib/crm/phone";
import { createClient } from "@/lib/supabase/server";

const connectionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  provider: z.enum(["uazapi", "meta_cloud"]),
  operationId: z.string().uuid(),
  phone: z.string().trim().optional(),
  visibleProfileName: z.string().trim().max(120).optional(),
  endpointUrl: z.string().trim().url().optional().or(z.literal("")),
  secretReference: z.string().trim().max(160).optional(),
});

export async function createConnectionAction(formData: FormData) {
  const parsed = connectionSchema.safeParse({
    name: formData.get("name"),
    provider: formData.get("provider"),
    operationId: formData.get("operationId"),
    phone: formData.get("phone") || undefined,
    visibleProfileName: formData.get("visibleProfileName") || undefined,
    endpointUrl: formData.get("endpointUrl") || "",
    secretReference: formData.get("secretReference") || undefined,
  });
  if (!parsed.success) {
    redirect(`/app/configuracoes/whatsapp?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Revise os campos.")}`);
  }

  const viewer = await requireActiveViewer();
  if (viewer.membership?.role === "broker") return;
  const operation = viewer.operations.find((item) => item.id === parsed.data.operationId);
  if (!operation) return;
  const phone = parsed.data.phone ? normalizePhoneToE164(parsed.data.phone) : null;
  if (parsed.data.phone && !phone) {
    redirect(`/app/configuracoes/whatsapp?erro=${encodeURIComponent("Telefone inválido.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("whatsapp_connections").insert({
    org_id: viewer.organization!.id,
    operation_id: operation.id,
    provider: parsed.data.provider,
    name: parsed.data.name,
    phone_e164: phone,
    visible_profile_name: parsed.data.visibleProfileName || null,
    endpoint_url: parsed.data.endpointUrl || null,
    secret_reference: parsed.data.secretReference || null,
    status: "draft",
    inbound_enabled: false,
    campaign_enabled: false,
    created_by: viewer.userId,
  });
  if (error) {
    redirect(`/app/configuracoes/whatsapp?erro=${encodeURIComponent("Não foi possível salvar a conexão.")}`);
  }
  revalidatePath("/app/configuracoes/whatsapp");
  redirect("/app/configuracoes/whatsapp?sucesso=rascunho-criado");
}

export async function changeConnectionStateAction(formData: FormData) {
  const parsed = z.object({
    connectionId: z.string().uuid(),
    action: z.enum(["activate", "pause", "revoke"]),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/app/configuracoes/whatsapp?erro=acao-invalida");
  const viewer = await requireActiveViewer();
  if (viewer.membership?.role !== "owner") redirect("/app/configuracoes/whatsapp?erro=acao-exclusiva-do-dono");
  const supabase = await createClient();
  const { error } = await supabase.from("connection_activation_requests").insert({
    org_id: viewer.organization!.id,
    connection_id: parsed.data.connectionId,
    action: parsed.data.action,
    inbound_enabled: formData.get("inboundEnabled") === "on",
    campaign_enabled: formData.get("campaignEnabled") === "on",
    reason: String(formData.get("reason") ?? "").trim() || null,
    actor_user_id: viewer.userId,
  });
  if (error) redirect(`/app/configuracoes/whatsapp?erro=${encodeURIComponent("Ativação exige configuração completa e health check saudável nos últimos 15 minutos.")}`);
  revalidatePath("/app/configuracoes/whatsapp");
  redirect("/app/configuracoes/whatsapp?sucesso=estado-atualizado");
}
