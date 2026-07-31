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
    .select("provider,status")
    .eq("id", connectionId)
    .maybeSingle();
  if (!connection || connection.provider !== "meta_cloud" || connection.status === "revoked") {
    return new Response("Not found", { status: 404 });
  }
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
    normalized = verifyAndNormalizeUazapiWebhook(json, secret, request.headers.get("token"));
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
          rawPayload: (parsed.data.raw_payload ?? json) as Json,
        }],
        statuses: [],
      };
    }
  }
  if (!normalized) return NextResponse.json({ error: "unsupported_payload" }, { status: 400 });

  let ingested = 0;
  let duplicates = 0;
  for (const status of normalized.statuses) {
    await admin.rpc("apply_provider_message_status", {
      p_connection_id: connectionId,
      p_error_redacted: status.errorRedacted,
      p_provider_message_id: status.providerMessageId,
      p_provider_timestamp: status.providerTimestamp,
      p_status: status.status,
    });
  }
  for (const message of normalized.inbound) {
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
      .select("duplicate")
      .single();
    if (error) return NextResponse.json({ error: "ingest_rejected" }, { status: 409 });
    if (data.duplicate) duplicates += 1;
    else ingested += 1;
  }
  return NextResponse.json({ received: true, ingested, duplicates, statuses: normalized.statuses.length });
}
