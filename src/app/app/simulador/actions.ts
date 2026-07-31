"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveViewer } from "@/lib/auth/session";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export async function runSimulationAction(formData:FormData){
  const parsed=z.object({title:z.string().trim().min(2).max(160),input:z.string().trim().min(1).max(12000),initialState:z.string().trim().max(12000).optional()}).safeParse({title:formData.get("title"),input:formData.get("input"),initialState:formData.get("initialState")||undefined});
  if(!parsed.success)redirect("/app/simulador?erro=revise-o-cenario"); let state:Json={};
  if(parsed.data.initialState){try{state=JSON.parse(parsed.data.initialState) as Json}catch{redirect("/app/simulador?erro=estado-inicial-deve-ser-json")}}
  const viewer=await requireActiveViewer(); const operation=viewer.operations.find((item)=>item.is_default)??viewer.operations[0]; const supabase=await createClient();
  const{error}=await supabase.from("simulator_run_requests").insert({org_id:viewer.organization!.id,operation_id:operation?.id??null,title:parsed.data.title,simulated_input:parsed.data.input,initial_state:state,actor_user_id:viewer.userId});
  if(error)redirect("/app/simulador?erro=modelo-ativo-e-chave-byok-sao-necessarios"); revalidatePath("/app/simulador"); redirect("/app/simulador?sucesso=execucao-registrada");
}

export async function runRegressionAction(){
  const viewer=await requireActiveViewer();const supabase=await createClient();
  const{error}=await supabase.from("regression_run_requests").insert({org_id:viewer.organization!.id,actor_user_id:viewer.userId});
  if(error)redirect(`/app/simulador?erro=${error.message.includes("already_active")?"regressao-ja-em-execucao":"configure-modelo-e-regras"}`);
  revalidatePath("/app/simulador");redirect("/app/simulador?sucesso=regressao-iniciada");
}
