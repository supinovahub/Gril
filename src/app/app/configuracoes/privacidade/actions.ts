"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function createPrivacyRequestAction(formData:FormData){const parsed=z.object({contactId:z.string().uuid(),requestType:z.enum(["access","export","correction","restriction","deletion","anonymization"])}).safeParse(Object.fromEntries(formData));if(!parsed.success)redirect("/app/configuracoes/privacidade?erro=solicitacao-invalida");const viewer=await requireActiveViewer();const supabase=await createClient();const{error}=await supabase.from("privacy_requests").insert({org_id:viewer.organization!.id,contact_id:parsed.data.contactId,request_type:parsed.data.requestType,requested_by:viewer.userId});if(error)redirect("/app/configuracoes/privacidade?erro=sem-permissao");revalidatePath("/app/configuracoes/privacidade");redirect("/app/configuracoes/privacidade?sucesso=solicitacao-aberta");}
