"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { canManageTeam, requireActiveViewer } from "@/lib/auth/session";
import { measureServerTask } from "@/lib/observability/server-performance";
import { TYPED_CONFIRMATION_PHRASE } from "@/lib/typed-confirmation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type StorageObject = { bucket: string; path: string };

export type HomologationPreview = {
  eligible: boolean;
  blocked: string[];
  counts: Record<string, number>;
};

function readStorageObjects(value: unknown): StorageObject[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is StorageObject => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Record<string, unknown>;
    return typeof candidate.bucket === "string" && typeof candidate.path === "string";
  });
}

async function removeStorageObjects(objects: StorageObject[]) {
  if (!objects.length) return true;

  try {
    const admin = createAdminClient();
    const grouped = new Map<string, string[]>();
    for (const object of objects) {
      if (!/^gril-(media|projects)$/.test(object.bucket) || object.path.length > 1024) return false;
      const paths = grouped.get(object.bucket) ?? [];
      paths.push(object.path);
      grouped.set(object.bucket, paths);
    }

    for (const [bucket, paths] of grouped) {
      const { error } = await admin.storage.from(bucket).remove(paths);
      if (error) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function loadHomologationPreviewAction(): Promise<HomologationPreview | null> {
  const viewer = await requireActiveViewer();
  if (!viewer.organization || viewer.supportAccess || !canManageTeam(viewer)) return null;

  const supabase = await createClient();
  const previewResult = await measureServerTask(
    "dashboard.homologation_preview",
    () => supabase.rpc("preview_homologation_context", {
      p_org_id: viewer.organization!.id,
    }),
  );

  return !previewResult.error && previewResult.data
    ? previewResult.data as unknown as HomologationPreview
    : null;
}

export async function purgeHomologationContextAction(formData: FormData) {
  const parsed = z.object({
    confirmation: z.literal(TYPED_CONFIRMATION_PHRASE),
  }).safeParse({ confirmation: formData.get("confirmation") });

  if (!parsed.success) {
    redirect(`/app?erro=${encodeURIComponent("Digite exatamente CONFIRMAR AÇÃO para limpar o contexto de homologação.")}`);
  }

  const viewer = await requireActiveViewer();
  if (!viewer.organization || viewer.supportAccess || !canManageTeam(viewer)) {
    redirect(`/app?erro=${encodeURIComponent("A limpeza de homologação exige dono ou gestor com team.manage.")}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("purge_homologation_context", {
    p_confirmation: parsed.data.confirmation,
    p_org_id: viewer.organization.id,
  });

  if (error || !data) {
    redirect(`/app?erro=${encodeURIComponent("A limpeza foi recusada. Revise o preview e os vínculos do contexto HML-.")}`);
  }

  const receipt = data as { status?: string; storage_objects?: unknown };
  if (receipt.status === "purged") {
    const storageOk = await removeStorageObjects(readStorageObjects(receipt.storage_objects));
    revalidatePath("/app");
    revalidatePath("/app/leads");
    revalidatePath("/app/inbox");
    revalidatePath("/app/agenda");
    revalidatePath("/app/campanhas");
    revalidatePath("/app/configuracoes/auditoria");
    redirect(`/app?limpeza=${storageOk ? "concluida" : "concluida-com-arquivos-pendentes"}`);
  }

  redirect(`/app?limpeza=${encodeURIComponent("nenhum-contexto-elegivel")}`);
}
