import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";
import { readBodyWithinLimit, sha256, verifyWebhookSecret } from "@/lib/webhooks/security";

const normalizedForm=z.object({external_submission_id:z.string().min(1).max(300),submitted_at:z.string().datetime({offset:true}).optional(),fields:z.record(z.string(),z.union([z.string(),z.number(),z.boolean(),z.null()]))});

export async function POST(request:Request,{params}:{params:Promise<{formId:string}>}){
  if(!verifyWebhookSecret(request.headers.get("x-gril-webhook-secret")))return NextResponse.json({error:"unauthorized"},{status:401});
  const raw=await readBodyWithinLimit(request);if(raw===null)return NextResponse.json({error:"payload_too_large"},{status:413});let json:unknown;try{json=JSON.parse(raw)}catch{return NextResponse.json({error:"invalid_json"},{status:400})}
  const parsed=normalizedForm.safeParse(json);if(!parsed.success)return NextResponse.json({error:"normalized_payload_required"},{status:400});const{formId}=await params;const supabase=createAdminClient();const{data:form}=await supabase.from("meta_lead_forms").select("org_id,status").eq("id",formId).maybeSingle();
  if(!form||form.status!=="active")return NextResponse.json({error:"form_not_active"},{status:404});const payload=parsed.data.fields as Json;const{data,error}=await supabase.from("meta_form_ingest_requests").insert({org_id:form.org_id,form_id:formId,external_submission_id:parsed.data.external_submission_id,submitted_at:parsed.data.submitted_at??null,payload,payload_sha256:sha256(JSON.stringify(payload))}).select("submission_id,prelead_id,result").single();
  if(error)return NextResponse.json({error:"ingest_rejected"},{status:409});return NextResponse.json(data,{status:data.result==="duplicate"?200:201});
}
