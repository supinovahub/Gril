import { NextResponse } from "next/server";
import { z } from "zod";

import type { Json } from "@/lib/database.types";
import {
  metaWebhookVerifyToken,
  normalizeMetaWebhook,
  parseMetaSecret,
  verifyAndNormalizeUazapiWebhook,
  verifyMetaWebhook,
  type NormalizedWhatsappWebhook,
} from "@/lib/integrations/whatsapp-runtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { readBodyWithinLimit, sha256, verifyWebhookSecret } from "@/lib/webhooks/security";

const normalizedWebhook = z.object({
  external_event_id: z.string().min(1).max(300),
  provider_message_id: z.string().min(1).max(300),
  from_e164: z.string().regex(/^\+[1-9][0-9]{7,14}$/),
  contact_name: z.string().trim().max(160).optional(),
  content_type: z.enum(["text", "image", "audio", "video", "document", "location", "unknown"]).default("text"),
  body: z.string().max(4096).nullable().optional(),
  provider_timestamp: z.string().datetime({ offset: true }).optional(),
  media: z.object({
    provider_media_id: z.string().max(500).optional(), source_url: z.string().url().optional(),
    mime_type: z.string().max(200).optional(), file_name: z.string().max(300).optional(), sha256: z.string().max(200).optional(),
  }).optional(),
  raw_payload: z.record(z.string(), z.unknown()).optional(),
});

type RouteParams = { params: Promise<{ connectionId: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const { connectionId } = await params;
  const query = new URL(request.url).searchParams;
  if (query.get("hub.mode") !== "subscribe") return new Response("Not found", { status: 404 });
  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("whatsapp_connections")
    .select("org_id,provider,status")
    .eq("id", connectionId)
    .maybeSingle();
  if (!connection || connection.provider !== "meta_cloud" || connection.status === "revoked") {
    return new Response("Not found", { status: 404 });
  }
  const { data: organization } = await admin.from("organizations").select("status").eq("id", connection.org_id).maybeSingle();
  if (!organization || organization.status === "archived") return new Response("Not found", { status: 404 });
  const expected = metaWebhookVerifyToken(connectionId);
  if (query.get("hub.verify_token") !== expected) return new Response("Forbidden", { status: 403 });
  return new Response(query.get("hub.challenge") ?? "", { status: 200 });
}

export async function POST(request: Request, { params }: RouteParams) {
  const raw = await readBodyWithinLimit(request);
  if (raw === null) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { connectionId } = await params;
  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("whatsapp_connections")
    .select("org_id,provider,status,inbound_enabled,integration_account_id")
    .eq("id", connectionId)
    .maybeSingle();
  if (!connection || connection.status !== "active" || !connection.inbound_enabled || !connection.integration_account_id) {
    return NextResponse.json({ error: "connection_not_active" }, { status: 404 });
  }
  const { data: organization } = await admin.from("organizations").select("status").eq("id", connection.org_id).maybeSingle();
  if (!organization || organization.status === "archived") {
    return NextResponse.json({ error: "organization_archived" }, { status: 410 });
  }
  const { data: secret, error: secretError } = await admin.rpc("get_integration_secret", {
    p_integration_account_id: connection.integration_account_id,
  });
  if (secretError || !secret) return NextResponse.json({ error: "credential_unavailable" }, { status: 503 });

  let normalized: NormalizedWhatsappWebhook | null = null;
  if (connection.provider === "meta_cloud") {
    const metaSecret = parseMetaSecret(secret);
    if (!verifyMetaWebhook(raw, request.headers.get("x-hub-signature-256"), metaSecret.appSecret)) {
      return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
    }
    normalized = normalizeMetaWebhook(json);
  } else if (connection.provider === "uazapi") {
    const { data: account } = await admin
      .from("integration_accounts")
      .select("external_account_id,metadata")
      .eq("id", connection.integration_account_id)
      .maybeSingle();
    const metadata = account?.metadata && typeof account.metadata === "object" && !Array.isArray(account.metadata)
      ? account.metadata
      : null;
    const instanceName = metadata && typeof metadata.instance_name === "string"
      ? metadata.instance_name
      : null;
    normalized = verifyAndNormalizeUazapiWebhook(
      json,
      secret,
      request.headers.get("token"),
      [account?.external_account_id, instanceName].filter((value): value is string => Boolean(value)),
    );
    if (!normalized) return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  } else if (verifyWebhookSecret(request.headers.get("x-gril-webhook-secret"))) {
    const parsed = normalizedWebhook.safeParse(json);
    if (parsed.success) {
      normalized = {
        inbound: [{
          externalEventId: parsed.data.external_event_id,
          providerMessageId: parsed.data.provider_message_id,
          fromE164: parsed.data.from_e164,
          contactName: parsed.data.contact_name,
          contentType: parsed.data.content_type,
          body: parsed.data.body,
          providerTimestamp: parsed.data.provider_timestamp,
          media: parsed.data.media ? {
            providerMediaId: parsed.data.media.provider_media_id,
            sourceUrl: parsed.data.media.source_url,
            mimeType: parsed.data.media.mime_type,
            fileName: parsed.data.media.file_name,
            sha256: parsed.data.media.sha256,
          } : undefined,
          rawPayload: (parsed.data.raw_payload ?? json) as Json,
        }],
        statuses: [],
        mutations: [],
      };
    }
  }
  if (!normalized) return NextResponse.json({ error: "unsupported_payload" }, { status: 400 });
  const rawEventType = json && typeof json === "object" && !Array.isArray(json)
    ? (json as Record<string, unknown>).EventType
    : null;
  if (
    connection.provider === "uazapi"
    && rawEventType === "messages"
    && normalized.inbound.length === 0
    && normalized.statuses.length === 0
    && normalized.mutations.length === 0
  ) {
    return NextResponse.json({ error: "uazapi_message_not_recognized" }, { status: 422 });
  }

  let ingested = 0;
  let duplicates = 0;
  let operational = 0;
  for (const status of normalized.statuses) {
    await admin.rpc("apply_provider_message_status", {
      p_connection_id: connectionId,
      p_error_redacted: status.errorRedacted,
      p_provider_message_id: status.providerMessageId,
      p_provider_timestamp: status.providerTimestamp,
      p_status: status.status,
    });
  }
  for (const mutation of normalized.mutations) {
    await admin.rpc("apply_provider_message_mutation", {
      p_body: mutation.body,
      p_connection_id: connectionId,
      p_emoji: mutation.emoji,
      p_external_event_id: mutation.externalEventId,
      p_kind: mutation.kind,
      p_provider_timestamp: mutation.providerTimestamp,
      p_target_provider_message_id: mutation.targetProviderMessageId,
    });
  }
  for (const message of normalized.inbound) {
    const { data: operationalResult, error: operationalError } = await admin.rpc("process_operational_whatsapp_reply", {
      p_body: message.body ?? "",
      p_connection_id: connectionId,
      p_external_event_id: message.externalEventId,
      p_from_e164: message.fromE164,
    });
    if (operationalError) return NextResponse.json({ error: "operational_reply_rejected" }, { status: 409 });
    if (operationalResult && typeof operationalResult === "object" && !Array.isArray(operationalResult) && operationalResult.operational === true) {
      operational += 1;
      continue;
    }
    const { data, error } = await admin
      .from("webhook_ingest_requests")
      .insert({
        org_id: connection.org_id,
        connection_id: connectionId,
        external_event_id: message.externalEventId,
        payload_sha256: sha256(JSON.stringify(message.rawPayload)),
        payload: message.rawPayload,
        from_e164: message.fromE164,
        contact_name: message.contactName ?? null,
        provider_message_id: message.providerMessageId,
        content_type: message.contentType,
        body: message.body ?? null,
        provider_timestamp: message.providerTimestamp ?? null,
      })
      .select("duplicate,message_id")
      .single();
    if (error) return NextResponse.json({ error: "ingest_rejected" }, { status: 409 });
    if (data.duplicate) duplicates += 1;
    else {
      ingested += 1;
      if (data.message_id && message.media && (message.media.providerMediaId || message.media.sourceUrl)) {
        const { error: mediaError } = await admin.from("message_media_sources").insert({
          message_id: data.message_id, org_id: connection.org_id, connection_id: connectionId,
          provider_media_id: message.media.providerMediaId ?? null, source_url: message.media.sourceUrl ?? null,
          mime_type: message.media.mimeType ?? null, file_name: message.media.fileName ?? null,
          provider_sha256: message.media.sha256 ?? null,
        });
        if (mediaError) return NextResponse.json({ error: "media_ingest_rejected" }, { status: 409 });
        const { error: jobError } = await admin.from("scheduled_jobs").insert({
          org_id: connection.org_id, job_type: "media.inbound.process", aggregate_type: "message",
          aggregate_id: data.message_id, target_queue: "media-processing", run_at: new Date().toISOString(),
          dedupe_key: `media-process:${data.message_id}`, payload: { message_id: data.message_id },
        });
        if (jobError) return NextResponse.json({ error: "media_job_rejected" }, { status: 409 });
      }
    }
  }
  return NextResponse.json({ received: true, ingested, duplicates, operational, statuses: normalized.statuses.length, mutations: normalized.mutations.length });
}
