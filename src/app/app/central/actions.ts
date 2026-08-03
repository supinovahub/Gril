"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

export async function markNotificationReadAction(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("notificationId"));
  if (!id.success) redirect("/app/central");

  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("recipient_membership_id", viewer.membership!.id);

  if (error) redirect("/app/central?erro=notificacao-indisponivel");
  revalidatePath("/app/central");
  redirect("/app/central");
}

export async function registerPushSubscriptionAction(input: unknown) {
  const parsed=z.object({endpoint:z.string().url().max(4000),keys:z.object({p256dh:z.string().min(20).max(1000),auth:z.string().min(10).max(500)}),userAgent:z.string().max(500).optional()}).safeParse(input);
  if(!parsed.success)return{ok:false,message:"Assinatura push inválida."};
  const viewer=await requireActiveViewer();const admin=createAdminClient();
  const{data:existing}=await admin.from("push_subscriptions").select("id,user_id").eq("endpoint",parsed.data.endpoint).maybeSingle();
  if(existing&&existing.user_id!==viewer.userId)return{ok:false,message:"Esta assinatura pertence a outro usuário."};
  const payload={org_id:viewer.organization!.id,user_id:viewer.userId,endpoint:parsed.data.endpoint,p256dh:parsed.data.keys.p256dh,auth_key:parsed.data.keys.auth,user_agent:parsed.data.userAgent??null,revoked_at:null,last_error_redacted:null};
  const{error}=existing?await admin.from("push_subscriptions").update(payload).eq("id",existing.id).eq("user_id",viewer.userId):await admin.from("push_subscriptions").insert(payload);
  return error?{ok:false,message:"Não foi possível registrar este navegador."}:{ok:true,message:"Notificações push ativadas neste navegador."};
}
