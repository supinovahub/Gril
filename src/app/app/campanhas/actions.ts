"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireActiveViewer } from "@/lib/auth/session";
import { campaignCsvRow, parseCsvLine, resolveCampaignCsvColumns } from "@/lib/campaigns/csv";
import { normalizePhoneToE164 } from "@/lib/crm/phone";
import { createClient } from "@/lib/supabase/server";

function campaignRedirect(message: string, kind: "erro" | "sucesso" = "erro"): never {
  redirect(`/app/campanhas?${kind}=${encodeURIComponent(message)}`);
}

export async function createCampaignAction(formData: FormData) {
  const parsed = z.object({
    connectionId: z.string().uuid(), name: z.string().trim().min(2).max(160),
    aiMode: z.enum(["off", "shadow", "assisted", "production"]),
    openingTemplate: z.string().trim().min(10).max(2000),
    consentStatement: z.string().trim().min(20).max(4000),
    consentSource: z.string().trim().min(5).max(1000), consentConfirmed: z.literal("on"),
    messageTemplateId: z.string().uuid().optional().or(z.literal("")),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) campaignRedirect(parsed.error.issues[0]?.message ?? "Revise a campanha.");
  const viewer = await requireActiveViewer();
  const operation = viewer.operations.find((item) => item.is_default) ?? viewer.operations[0];
  if (!operation) campaignRedirect("Cadastre uma operação antes da campanha.");
  const supabase = await createClient();
  const { error } = await supabase.from("campaign_creation_requests").insert({
    org_id: viewer.organization!.id, operation_id: operation.id, connection_id: parsed.data.connectionId,
    name: parsed.data.name, ai_mode: parsed.data.aiMode, opening_template: parsed.data.openingTemplate,
    message_template_id: parsed.data.messageTemplateId || null,
    consent_statement: parsed.data.consentStatement, consent_source: parsed.data.consentSource, actor_user_id: viewer.userId,
  });
  if (error) campaignRedirect(error.message.includes("active_campaign_connection_required") ? "Escolha uma conexão ativa e habilitada para campanhas." : "Não foi possível criar a campanha.");
  revalidatePath("/app/campanhas");
  campaignRedirect("Campanha criada. Importe e revise a base.", "sucesso");
}

export async function importCampaignAction(formData: FormData) {
  const campaignId = z.string().uuid().safeParse(formData.get("campaignId"));
  if (!campaignId.success) campaignRedirect("Campanha inválida.");
  const file = formData.get("csvFile");
  const pasted = String(formData.get("csvText") ?? "").trim();
  let text = pasted;
  let filename = "base-colada.csv";
  if (file instanceof File && file.size > 0) {
    if (file.size > 1_000_000) campaignRedirect("O CSV do MVP deve ter até 1 MB.");
    text = await file.text(); filename = file.name;
  }
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) campaignRedirect("Informe cabeçalho e ao menos um contato.");
  const rawHeader = parseCsvLine(lines[0]);
  const requestedName = String(formData.get("nameColumn") ?? "").trim();
  const requestedPhone = String(formData.get("phoneColumn") ?? "").trim();
  const mapping = resolveCampaignCsvColumns(rawHeader, requestedName, requestedPhone);
  if (!mapping.valid) {
    campaignRedirect(`Não encontramos as colunas informadas. Cabeçalhos disponíveis: ${rawHeader.join(", ")}.`);
  }
  const rows = lines.slice(1).map((line) => campaignCsvRow(
    parseCsvLine(line), mapping.nameIndex, mapping.phoneIndex,
  ));
  if (rows.length > 500) campaignRedirect("O MVP aceita até 500 contatos por campanha.");
  const invalidNameLines = rows.flatMap((row, index) => row.name.length < 2 ? [index + 2] : []);
  const invalidPhoneLines = rows.flatMap((row, index) => normalizePhoneToE164(row.phone) ? [] : [index + 2]);
  if (rows.every((row) => row.name.length < 2 || !normalizePhoneToE164(row.phone))) {
    const details = [
      invalidNameLines.length ? `nome inválido nas linhas ${invalidNameLines.slice(0, 5).join(", ")}` : "",
      invalidPhoneLines.length ? `telefone inválido nas linhas ${invalidPhoneLines.slice(0, 5).join(", ")}` : "",
    ].filter(Boolean).join("; ");
    campaignRedirect(`Nenhum contato válido foi encontrado: ${details}. Use telefone com DDD; o +55 é adicionado automaticamente.`);
  }
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { data: result, error } = await supabase.from("campaign_import_requests").insert({
    org_id: viewer.organization!.id, campaign_id: campaignId.data, filename, rows,
    mapping: { name: rawHeader[mapping.nameIndex], phone: rawHeader[mapping.phoneIndex] },
    file_sha256: createHash("sha256").update(text).digest("hex"), actor_user_id: viewer.userId,
  }).select("valid_rows,duplicate_rows,error_rows").single();
  if (error) {
    if (error.message.includes("campaign_file_already_imported")) {
      campaignRedirect("Este mesmo arquivo já foi processado com contatos válidos nesta campanha.");
    }
    if (error.message.includes("campaign_not_importable")) {
      campaignRedirect("Esta campanha não aceita uma nova base no estado atual.");
    }
    campaignRedirect("Não foi possível processar a base. Confira os cabeçalhos e tente novamente.");
  }
  if (!result) campaignRedirect("A base foi processada, mas o resumo não pôde ser carregado.");
  revalidatePath("/app/campanhas");
  const summary = `${result.valid_rows} válidos, ${result.duplicate_rows} duplicados e ${result.error_rows} erros.`;
  campaignRedirect(
    result.valid_rows > 0 ? `Base processada: ${summary}` : `Nenhum contato novo foi importado: ${summary}`,
    result.valid_rows > 0 ? "sucesso" : "erro",
  );
}

export async function transitionCampaignAction(formData: FormData) {
  const parsed = z.object({ campaignId: z.string().uuid(), action: z.enum(["approve","start","pause","resume","cancel","complete"]), expectedVersion: z.coerce.number().int().positive(), reason: z.string().trim().max(500).optional() }).safeParse({ campaignId: formData.get("campaignId"), action: formData.get("action"), expectedVersion: formData.get("expectedVersion"), reason: formData.get("reason") || undefined });
  if (!parsed.success) campaignRedirect("Ação de campanha inválida.");
  const viewer = await requireActiveViewer(); const supabase = await createClient();
  const { error } = await supabase.from("campaign_transition_requests").insert({ org_id: viewer.organization!.id, campaign_id: parsed.data.campaignId, requested_action: parsed.data.action, expected_version: parsed.data.expectedVersion, reason: parsed.data.reason ?? null, actor_user_id: viewer.userId });
  if (error) campaignRedirect(error.message.includes("version") ? "A campanha mudou; atualize a página." : "Transição recusada pelas regras da campanha.");
  revalidatePath("/app/campanhas"); campaignRedirect("Estado atualizado.", "sucesso");
}

export async function releaseWaveAction(formData: FormData) {
  const parsed = z.object({ campaignId: z.string().uuid(), count: z.coerce.number().int().min(1).max(500) }).safeParse({ campaignId: formData.get("campaignId"), count: formData.get("count") });
  if (!parsed.success) campaignRedirect("Volume de onda inválido.");
  const viewer = await requireActiveViewer(); const supabase = await createClient();
  const { error } = await supabase.from("campaign_wave_release_requests").insert({ org_id: viewer.organization!.id, campaign_id: parsed.data.campaignId, requested_count: parsed.data.count, actor_user_id: viewer.userId });
  if (error) campaignRedirect("Onda recusada: revise aprovação, limite, conexão, pausa e capacidade.");
  revalidatePath("/app/campanhas"); campaignRedirect("Onda liberada e contatos revalidados.", "sucesso");
}

