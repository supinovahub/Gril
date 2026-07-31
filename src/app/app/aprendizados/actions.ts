"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function createLearningAction(formData:FormData){
  const parsed=z.object({observation:z.string().trim().min(5).max(4000),suggestedChange:z.string().trim().min(5).max(4000),observedResponse:z.string().trim().max(4000).optional(),scope:z.enum(["style","rule","faq","qualification","scheduling","escalation"])}).safeParse({observation:formData.get("observation"),suggestedChange:formData.get("suggestedChange"),observedResponse:formData.get("observedResponse")||undefined,scope:formData.get("scope")});
  if(!parsed.success)redirect("/app/aprendizados?erro=revise-os-campos"); const viewer=await requireActiveViewer(); const operation=viewer.operations.find((item)=>item.is_default)??viewer.operations[0]; const supabase=await createClient();
  const{error}=await supabase.from("learning_suggestions").insert({org_id:viewer.organization!.id,operation_id:operation?.id??null,source:"manual",observed_response:parsed.data.observedResponse??null,human_observation:parsed.data.observation,suggested_change:parsed.data.suggestedChange,scope:parsed.data.scope,created_by:viewer.userId});
  if(error)redirect("/app/aprendizados?erro=nao-foi-possivel-criar"); revalidatePath("/app/aprendizados"); redirect("/app/aprendizados?sucesso=sugestao-criada");
}

export async function reviewLearningAction(formData:FormData){
  const parsed=z.object({suggestionId:z.string().uuid(),decision:z.enum(["approve_draft","reject","mark_conflict"]),reason:z.string().trim().max(1000).optional()}).safeParse({suggestionId:formData.get("suggestionId"),decision:formData.get("decision"),reason:formData.get("reason")||undefined});
  if(!parsed.success)redirect("/app/aprendizados?erro=decisao-invalida"); const viewer=await requireActiveViewer(); const supabase=await createClient();
  const{error}=await supabase.from("learning_review_requests").insert({org_id:viewer.organization!.id,learning_suggestion_id:parsed.data.suggestionId,decision:parsed.data.decision,reason:parsed.data.reason??null,actor_user_id:viewer.userId});
  if(error)redirect("/app/aprendizados?erro=sugestao-ja-revisada-ou-conflitante"); revalidatePath("/app/aprendizados"); redirect("/app/aprendizados?sucesso=decisao-registrada");
}
