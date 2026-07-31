"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function updateAlertAction(formData:FormData){
  const parsed=z.object({alertId:z.string().uuid(),status:z.enum(["acknowledged","resolved"])}).safeParse(Object.fromEntries(formData));
  if(!parsed.success)redirect("/app/central?erro=alerta-invalido"); const viewer=await requireActiveViewer(); const supabase=await createClient(); const now=new Date().toISOString();
  const patch=parsed.data.status==="acknowledged"?{status:"acknowledged" as const,acknowledged_by:viewer.userId,acknowledged_at:now}:{status:"resolved" as const,resolved_at:now};
  const{error}=await supabase.from("alerts").update(patch).eq("id",parsed.data.alertId).eq("org_id",viewer.organization!.id);
  if(error)redirect("/app/central?erro=sem-permissao"); revalidatePath("/app/central"); redirect("/app/central");
}

export async function claimEscalationAction(formData:FormData){
  const id=z.string().uuid().safeParse(formData.get("escalationId")); if(!id.success)redirect("/app/central"); const viewer=await requireActiveViewer(); const supabase=await createClient();
  const{error}=await supabase.from("escalations").update({status:"claimed",claimed_by:viewer.membership!.id,claimed_at:new Date().toISOString()}).eq("id",id.data).eq("status","open");
  if(error)redirect("/app/central?erro=escalada-indisponivel"); revalidatePath("/app/central"); redirect("/app/central");
}
