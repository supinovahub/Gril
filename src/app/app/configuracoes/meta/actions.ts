"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function createMetaFormAction(formData:FormData){
  const parsed=z.object({connectionId:z.string().uuid(),externalFormId:z.string().trim().min(1).max(300),name:z.string().trim().min(2).max(160),nameField:z.string().trim().min(1).max(100),phoneField:z.string().trim().min(1).max(100),consentText:z.string().trim().min(20).max(4000)}).safeParse(Object.fromEntries(formData));
  if(!parsed.success)redirect("/app/configuracoes/meta?erro=revise-os-campos");const viewer=await requireActiveViewer();const operation=viewer.operations.find((item)=>item.is_default)??viewer.operations[0];if(!operation)redirect("/app/configuracoes/meta?erro=sem-operacao");const supabase=await createClient();
  const{error}=await supabase.from("meta_form_creation_requests").insert({org_id:viewer.organization!.id,operation_id:operation.id,connection_id:parsed.data.connectionId,external_form_id:parsed.data.externalFormId,name:parsed.data.name,field_mapping:{name:parsed.data.nameField,phone:parsed.data.phoneField},consent_text:parsed.data.consentText,actor_user_id:viewer.userId});
  if(error)redirect("/app/configuracoes/meta?erro=conexao-meta-ativa-e-obrigatoria");revalidatePath("/app/configuracoes/meta");redirect("/app/configuracoes/meta?sucesso=formulario-publicado");
}
