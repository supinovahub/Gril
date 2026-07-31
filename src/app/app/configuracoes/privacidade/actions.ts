"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function createPrivacyRequestAction(formData:FormData){const parsed=z.object({contactId:z.string().uuid(),requestType:z.enum(["access","export","correction","restriction","deletion","anonymization"])}).safeParse(Object.fromEntries(formData));if(!parsed.success)redirect("/app/configuracoes/privacidade?erro=solicitacao-invalida");const viewer=await requireActiveViewer();const supabase=await createClient();const{error}=await supabase.from("privacy_requests").insert({org_id:viewer.organization!.id,contact_id:parsed.data.contactId,request_type:parsed.data.requestType,requested_by:viewer.userId});if(error)redirect("/app/configuracoes/privacidade?erro=sem-permissao");revalidatePath("/app/configuracoes/privacidade");redirect("/app/configuracoes/privacidade?sucesso=solicitacao-aberta");}

export async function reviewPrivacyRequestAction(formData: FormData) {
  const parsed = z.object({
    privacyRequestId: z.string().uuid(),
    action: z.enum(["start_review", "legal_hold", "release_hold", "complete", "reject"]),
    notes: z.string().trim().min(5).max(2000),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/app/configuracoes/privacidade?erro=revise-a-decisao-e-as-notas");
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { error } = await supabase.from("privacy_review_requests").insert({
    org_id: viewer.organization!.id,
    privacy_request_id: parsed.data.privacyRequestId,
    action: parsed.data.action,
    notes: parsed.data.notes,
    actor_user_id: viewer.userId,
  });
  if (error) redirect(`/app/configuracoes/privacidade?erro=${encodeURIComponent("Transição recusada: revise o estado e a justificativa.")}`);
  revalidatePath("/app/configuracoes/privacidade");
  redirect("/app/configuracoes/privacidade?sucesso=decisao-registrada");
}
