import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getViewer } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const reserveSchema = z.object({
  action: z.literal("reserve"),
  projectId: z.string().uuid(),
  mediaType: z.enum(["cover", "image", "pdf"]),
  title: z.string().trim().min(2).max(160),
  mimeType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  sizeBytes: z.number().int().positive().max(20 * 1024 * 1024),
});
const finalizeSchema = z.object({ action: z.literal("finalize"), uploadId: z.string().uuid() });
const deleteSchema = z.object({ mediaId: z.string().uuid() });

function canManageKnowledge(viewer: NonNullable<Awaited<ReturnType<typeof getViewer>>>) {
  return viewer.membership?.status === "active" && (
    viewer.membership.role === "owner" ||
    viewer.membership.role === "manager" && viewer.permissions.includes("ai.manage")
  );
}

async function authorizedViewer() {
  const viewer = await getViewer();
  return viewer?.organization && canManageKnowledge(viewer) ? viewer : null;
}

function extensionFor(mimeType: "image/jpeg" | "image/png" | "application/pdf") {
  return mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "pdf";
}

export async function POST(request: Request) {
  const viewer = await authorizedViewer();
  if (!viewer) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const raw: unknown = await request.json().catch(() => null);
  const admin = createAdminClient();

  if ((raw as { action?: unknown } | null)?.action === "reserve") {
    const parsed = reserveSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
    const input = parsed.data;
    const validPair = input.mediaType === "pdf"
      ? input.mimeType === "application/pdf"
      : ["image/jpeg", "image/png"].includes(input.mimeType);
    const validSize = input.mediaType === "pdf" ? input.sizeBytes <= 20 * 1024 * 1024 : input.sizeBytes <= 5 * 1024 * 1024;
    if (!validPair || !validSize) return NextResponse.json({ error: "Tipo ou tamanho não aprovado." }, { status: 400 });
    const { data: project } = await admin.from("projects").select("id").eq("id", input.projectId).eq("org_id", viewer.organization!.id).maybeSingle();
    if (!project) return NextResponse.json({ error: "Empreendimento não encontrado." }, { status: 404 });

    const storagePath = `${viewer.organization!.id}/${input.projectId}/${randomUUID()}.${extensionFor(input.mimeType)}`;
    const { data: upload, error: insertError } = await admin.from("project_media_uploads").insert({
      org_id: viewer.organization!.id,
      project_id: input.projectId,
      media_type: input.mediaType,
      title: input.title,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      storage_path: storagePath,
      actor_user_id: viewer.userId,
    }).select("id,storage_path").single();
    if (insertError) return NextResponse.json({ error: "Não foi possível reservar esse espaço. Exclua uma mídia se o limite estiver cheio." }, { status: 409 });
    const { data: signed, error: signedError } = await admin.storage.from("gril-projects").createSignedUploadUrl(storagePath);
    if (signedError || !signed) {
      await admin.from("project_media_uploads").update({ status: "failed", error_redacted: "signed_upload_failed" }).eq("id", upload.id);
      return NextResponse.json({ error: "Não foi possível iniciar o upload." }, { status: 500 });
    }
    return NextResponse.json({ uploadId: upload.id, path: signed.path, token: signed.token });
  }

  const parsed = finalizeSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Finalização inválida." }, { status: 400 });
  const { data: upload } = await admin.from("project_media_uploads").select("*")
    .eq("id", parsed.data.uploadId).eq("org_id", viewer.organization!.id).eq("actor_user_id", viewer.userId).eq("status", "reserved").maybeSingle();
  if (!upload || new Date(upload.expires_at).valueOf() <= Date.now()) return NextResponse.json({ error: "Reserva expirada." }, { status: 410 });
  const { data: object, error: downloadError } = await admin.storage.from("gril-projects").download(upload.storage_path);
  if (downloadError || !object) return NextResponse.json({ error: "O arquivo ainda não chegou ao armazenamento." }, { status: 409 });
  if (object.size !== upload.size_bytes || object.type !== upload.mime_type) {
    await admin.storage.from("gril-projects").remove([upload.storage_path]);
    await admin.from("project_media_uploads").update({ status: "failed", error_redacted: "binary_validation_failed" }).eq("id", upload.id);
    return NextResponse.json({ error: "O conteúdo recebido não confere com o arquivo aprovado." }, { status: 400 });
  }
  const { data: lastMedia } = await admin.from("project_media").select("sort_order").eq("project_id", upload.project_id).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { data: media, error: mediaError } = await admin.from("project_media").insert({
    org_id: upload.org_id,
    project_id: upload.project_id,
    media_type: upload.media_type,
    storage_path: upload.storage_path,
    title: upload.title,
    sort_order: Math.min(1000, (lastMedia?.sort_order ?? -1) + 1),
    mime_type: upload.mime_type,
    size_bytes: upload.size_bytes,
    active: true,
    published_at: new Date().toISOString(),
    published_by: viewer.userId,
  }).select("id").single();
  if (mediaError) {
    await admin.storage.from("gril-projects").remove([upload.storage_path]);
    await admin.from("project_media_uploads").update({ status: "failed", error_redacted: "media_limit_or_validation_failed" }).eq("id", upload.id);
    return NextResponse.json({ error: "Limite atingido. Exclua uma mídia antes de adicionar outra." }, { status: 409 });
  }
  if (upload.media_type === "cover") {
    const { error: coverError } = await admin.from("projects").update({ cover_storage_path: upload.storage_path })
      .eq("id", upload.project_id).eq("org_id", upload.org_id);
    if (coverError) {
      await admin.from("project_media").delete().eq("id", media.id);
      await admin.storage.from("gril-projects").remove([upload.storage_path]);
      await admin.from("project_media_uploads").update({ status: "failed", error_redacted: "cover_sync_failed" }).eq("id", upload.id);
      return NextResponse.json({ error: "A foto chegou, mas não foi possível defini-la como principal." }, { status: 500 });
    }
  }
  await admin.from("project_media_uploads").update({ status: "completed", media_id: media.id, completed_at: new Date().toISOString() }).eq("id", upload.id);
  return NextResponse.json({ mediaId: media.id });
}

export async function DELETE(request: Request) {
  const viewer = await authorizedViewer();
  if (!viewer) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Mídia inválida." }, { status: 400 });
  const admin = createAdminClient();
  const { data: media } = await admin.from("project_media").select("id,storage_path,title,project_id,media_type")
    .eq("id", parsed.data.mediaId).eq("org_id", viewer.organization!.id).maybeSingle();
  if (!media?.storage_path) return NextResponse.json({ error: "Mídia não encontrada." }, { status: 404 });
  const { error: storageError } = await admin.storage.from("gril-projects").remove([media.storage_path]);
  if (storageError) return NextResponse.json({ error: "A exclusão física falhou; o registro foi preservado." }, { status: 502 });
  const { error: deleteError } = await admin.from("project_media").delete().eq("id", media.id);
  if (deleteError) return NextResponse.json({ error: "O arquivo foi excluído, mas a limpeza do registro precisa de suporte." }, { status: 500 });
  if (media.media_type === "cover") {
    const { error: projectError } = await admin.from("projects").update({
      cover_storage_path: null,
      status: "draft",
      recommendable: false,
    }).eq("id", media.project_id).eq("org_id", viewer.organization!.id);
    if (projectError) return NextResponse.json({ error: "A capa foi excluída, mas o empreendimento precisa de revisão." }, { status: 500 });
  }
  return NextResponse.json({ deleted: true });
}
