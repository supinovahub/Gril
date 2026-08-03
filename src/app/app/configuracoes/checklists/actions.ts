"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function publishChecklistTemplateAction(formData: FormData) {
  const parsed = z.object({ operationId: z.string().uuid(), stageCode: z.enum(["proposal", "reservation", "documents", "payment", "sale"]), name: z.string().trim().min(2).max(160), itemsText: z.string().trim().min(3).max(10000) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/app/configuracoes/checklists?erro=revise-o-template");
  const items = parsed.data.itemsText.split(/\r?\n/).map((line)=>line.trim()).filter(Boolean).map((line)=>({ required: !line.startsWith("[ ]"), label: line.replace(/^\[(?:x| )\]\s*/i, "").trim() })).filter((item)=>item.label);
  if (!items.length || items.length>50) redirect("/app/configuracoes/checklists?erro=informe-de-1-a-50-itens");
  const viewer=await requireActiveViewer(); const supabase=await createClient();
  const { error } = await supabase.from("checklist_template_requests").insert({ org_id: viewer.organization!.id, operation_id: parsed.data.operationId, stage_code: parsed.data.stageCode, name: parsed.data.name, items, actor_user_id: viewer.userId });
  if (error) redirect("/app/configuracoes/checklists?erro=publicacao-recusada");
  revalidatePath("/app/configuracoes/checklists"); redirect("/app/configuracoes/checklists?sucesso=versao-publicada");
}
