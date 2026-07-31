import { NextResponse } from "next/server";
import { z } from "zod";

import type { Json } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { readBodyWithinLimit, sha256, verifyWebhookSecret } from "@/lib/webhooks/security";

const normalizedWebhook = z.object({
  external_event_id: z.string().min(1).max(300),
  provider_message_id: z.string().min(1).max(300),
  from_e164: z.string().regex(/^\+[1-9][0-9]{7,14}$/),
  contact_name: z.string().trim().max(160).optional(),
  content_type: z.enum(["text","image","audio","video","document","location","unknown"]).default("text"),
  body: z.string().max(4096).nullable().optional(),
  provider_timestamp: z.string().datetime({offset:true}).optional(),
  raw_payload: z.record(z.string(),z.unknown()).optional(),
});

export async function POST(request:Request,{params}:{params:Promise<{connectionId:string}>}){
  if(!verifyWebhookSecret(request.headers.get("x-gril-webhook-secret")))return NextResponse.json({error:"unauthorized"},{status:401});
  const raw=await readBodyWithinLimit(request);if(raw===null)return NextResponse.json({error:"payload_too_large"},{status:413});
  let json:unknown;try{json=JSON.parse(raw)}catch{return NextResponse.json({error:"invalid_json"},{status:400})}
  const parsed=normalizedWebhook.safeParse(json);if(!parsed.success)return NextResponse.json({error:"normalized_payload_required",issues:parsed.error.issues.map((item)=>item.path.join("."))},{status:400});
  const{connectionId}=await params;const supabase=createAdminClient();const{data:connection}=await supabase.from("whatsapp_connections").select("org_id,status,inbound_enabled").eq("id",connectionId).maybeSingle();
  if(!connection||connection.status!=="active"||!connection.inbound_enabled)return NextResponse.json({error:"connection_not_active"},{status:404});
  const payload=(parsed.data.raw_payload??json) as Json;const{data,error}=await supabase.from("webhook_ingest_requests").insert({org_id:connection.org_id,connection_id:connectionId,external_event_id:parsed.data.external_event_id,payload_sha256:sha256(JSON.stringify(payload)),payload,from_e164:parsed.data.from_e164,contact_name:parsed.data.contact_name??null,provider_message_id:parsed.data.provider_message_id,content_type:parsed.data.content_type,body:parsed.data.body??null,provider_timestamp:parsed.data.provider_timestamp??null}).select("conversation_id,message_id,duplicate").single();
  if(error)return NextResponse.json({error:"ingest_rejected"},{status:409});return NextResponse.json(data,{status:data.duplicate?200:201});
}
