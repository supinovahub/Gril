import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import type { Json } from "../database.types";
import { normalizePhoneToE164 } from "../crm/phone";

export type WhatsappProvider = "uazapi" | "meta_cloud";

export type NormalizedInboundMessage = {
  externalEventId: string;
  providerMessageId: string;
  fromE164: string;
  contactName?: string;
  contentType: "text" | "image" | "audio" | "video" | "document" | "location" | "unknown";
  body?: string | null;
  providerTimestamp?: string;
  rawPayload: Json;
};

export type NormalizedStatusUpdate = {
  providerMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  providerTimestamp?: string;
  errorRedacted?: string;
};

export type NormalizedWhatsappWebhook = {
  inbound: NormalizedInboundMessage[];
  statuses: NormalizedStatusUpdate[];
};

export class RuntimeProviderError extends Error {
  constructor(
    public readonly code: string,
    public readonly redactedMessage: string,
    public readonly retryable = false,
    public readonly uncertain = false,
  ) {
    super(code);
    this.name = "RuntimeProviderError";
  }
}

function safeEqual(left: string | null | undefined, right: string) {
  if (!left) return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function timestampFromSeconds(value: unknown) {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (typeof numeric !== "number" || !Number.isFinite(numeric)) return undefined;
  const milliseconds = numeric > 10_000_000_000 ? numeric : numeric * 1000;
  const date = new Date(milliseconds);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

function redactPayload(value: unknown, depth = 0): Json {
  if (depth > 8) return "[truncated]";
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.length > 12_000 ? `${value.slice(0, 12_000)}…` : value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => redactPayload(item, depth + 1));
  const source = record(value);
  if (!source) return String(value);
  const output: Record<string, Json> = {};
  for (const [key, item] of Object.entries(source).slice(0, 150)) {
    if (/token|secret|authorization|api[_-]?key|appsecret/i.test(key)) {
      output[key] = "[redacted]";
    } else {
      output[key] = redactPayload(item, depth + 1);
    }
  }
  return output;
}

function mapContentType(value: string | undefined) {
  const normalized = value?.toLowerCase() ?? "unknown";
  if (normalized.includes("text") || normalized === "conversation") return "text" as const;
  if (normalized.includes("image")) return "image" as const;
  if (normalized.includes("audio") || normalized.includes("ptt")) return "audio" as const;
  if (normalized.includes("video")) return "video" as const;
  if (normalized.includes("document") || normalized.includes("file")) return "document" as const;
  if (normalized.includes("location")) return "location" as const;
  return "unknown" as const;
}

function providerStatus(value: unknown): NormalizedStatusUpdate["status"] | null {
  const normalized = text(value)?.toLowerCase();
  if (!normalized) return null;
  if (["sent", "server_ack", "played"].includes(normalized)) return "sent";
  if (["delivered", "delivery_ack"].includes(normalized)) return "delivered";
  if (["read", "read_ack"].includes(normalized)) return "read";
  if (["failed", "error", "revoked"].includes(normalized)) return "failed";
  return null;
}

export function metaWebhookVerifyToken(connectionId: string) {
  const secret = process.env.GRIL_WEBHOOK_INGEST_SECRET;
  if (!secret) throw new Error("GRIL_WEBHOOK_INGEST_SECRET não configurado.");
  return createHmac("sha256", secret).update(`meta-webhook:${connectionId}`).digest("hex");
}

export function verifyMetaWebhook(rawBody: string, signature: string | null, appSecret: string) {
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  return safeEqual(signature, expected);
}

export function normalizeMetaWebhook(raw: unknown): NormalizedWhatsappWebhook {
  const root = record(raw);
  const inbound: NormalizedInboundMessage[] = [];
  const statuses: NormalizedStatusUpdate[] = [];
  if (!root || root.object !== "whatsapp_business_account" || !Array.isArray(root.entry)) {
    return { inbound, statuses };
  }

  for (const entryValue of root.entry) {
    const entry = record(entryValue);
    if (!entry || !Array.isArray(entry.changes)) continue;
    for (const changeValue of entry.changes) {
      const change = record(changeValue);
      if (!change) continue;
      const value = record(change.value);
      if (!value) continue;
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const firstContact = record(contacts[0]);
      const profile = record(firstContact?.profile);
      const contactName = text(profile?.name);

      if (Array.isArray(value.messages)) {
        for (const item of value.messages) {
          const message = record(item);
          const providerMessageId = text(message?.id);
          const fromE164 = normalizePhoneToE164(text(message?.from) ?? "");
          if (!message || !providerMessageId || !fromE164) continue;
          const messageType = text(message.type);
          const contentType = mapContentType(messageType);
          const textBody = text(record(message.text)?.body);
          const caption = text(record(message[messageType ?? ""])?.caption);
          inbound.push({
            externalEventId: providerMessageId,
            providerMessageId,
            fromE164,
            contactName,
            contentType,
            body: textBody ?? caption ?? null,
            providerTimestamp: timestampFromSeconds(message.timestamp),
            rawPayload: redactPayload({ entryId: entry.id, changeField: change.field, message }),
          });
        }
      }

      if (Array.isArray(value.statuses)) {
        for (const item of value.statuses) {
          const statusValue = record(item);
          if (!statusValue) continue;
          const providerMessageId = text(statusValue.id);
          const status = providerStatus(statusValue.status);
          if (!providerMessageId || !status) continue;
          const errors = Array.isArray(statusValue.errors) ? statusValue.errors : [];
          const firstError = record(errors[0]);
          statuses.push({
            providerMessageId,
            status,
            providerTimestamp: timestampFromSeconds(statusValue.timestamp),
            errorRedacted: status === "failed" ? text(firstError?.title) ?? "Meta informou falha no envio." : undefined,
          });
        }
      }
    }
  }
  return { inbound, statuses };
}

function findUazapiMessage(root: Record<string, unknown>) {
  const data = record(root.data);
  return record(root.message) ?? record(data?.message) ?? data ?? root;
}

export function verifyAndNormalizeUazapiWebhook(
  raw: unknown,
  credential: string,
  headerToken?: string | null,
): NormalizedWhatsappWebhook | null {
  const root = record(raw);
  if (!root) return null;
  const receivedToken = text(root.token) ?? headerToken ?? text(record(root.data)?.token);
  if (!safeEqual(receivedToken, credential)) return null;

  const inbound: NormalizedInboundMessage[] = [];
  const statuses: NormalizedStatusUpdate[] = [];
  const eventType = (text(root.EventType) ?? text(root.event) ?? text(root.type) ?? "").toLowerCase();
  const message = findUazapiMessage(root);
  if (!message) return { inbound, statuses };
  const providerMessageId = text(message.messageid) ?? text(message.messageId) ?? text(message.id) ?? text(record(message.key)?.id);

  if (eventType.includes("update") || (!text(message.text) && providerStatus(message.status))) {
    const status = providerStatus(message.status);
    if (providerMessageId && status) {
      statuses.push({
        providerMessageId,
        status,
        providerTimestamp: timestampFromSeconds(message.messageTimestamp ?? message.timestamp),
        errorRedacted: status === "failed" ? "Uazapi informou falha no envio." : undefined,
      });
    }
    return { inbound, statuses };
  }

  const fromMe = message.fromMe === true || message.wasSentByApi === true;
  const isGroup = message.isGroup === true || text(message.chatid)?.endsWith("@g.us") === true;
  const rawFrom = text(message.sender) ?? text(message.from) ?? text(message.chatid)?.split("@")[0] ?? "";
  const fromE164 = normalizePhoneToE164(rawFrom);
  if (!fromMe && !isGroup && providerMessageId && fromE164) {
    const contentType = mapContentType(text(message.messageType) ?? text(message.type));
    inbound.push({
      externalEventId: providerMessageId,
      providerMessageId,
      fromE164,
      contactName: text(message.senderName) ?? text(message.pushName),
      contentType,
      body: text(message.text) ?? text(message.body) ?? text(message.caption) ?? null,
      providerTimestamp: timestampFromSeconds(message.messageTimestamp ?? message.timestamp),
      rawPayload: redactPayload(raw),
    });
  }
  return { inbound, statuses };
}

async function runtimeFetch(url: string, init: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new RuntimeProviderError(
      "provider_send_uncertain",
      "O provedor não confirmou o envio. A mensagem não será reenviada automaticamente para evitar duplicidade.",
      false,
      true,
    );
  }
  const raw = await response.text();
  let body: unknown = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    if (response.ok) throw new RuntimeProviderError("provider_invalid_json", "O provedor devolveu uma confirmação inválida.");
  }
  if (!response.ok) {
    if (response.status === 429) {
      throw new RuntimeProviderError("provider_rate_limited", "O provedor limitou temporariamente os envios.", true);
    }
    const uncertain = response.status >= 500;
    throw new RuntimeProviderError(
      `provider_http_${response.status}`,
      uncertain
        ? "O provedor falhou sem confirmar se processou a mensagem; o envio foi interrompido para evitar duplicidade."
        : "O provedor recusou a mensagem.",
      false,
      uncertain,
    );
  }
  return body;
}

export async function sendWhatsappText(input: {
  provider: WhatsappProvider;
  endpointUrl: string;
  secret: string;
  externalPhoneNumberId?: string | null;
  toE164: string;
  body: string;
  messageId: string;
}) {
  if (input.provider === "uazapi") {
    const response = await runtimeFetch(`${input.endpointUrl.replace(/\/$/, "")}/send/text`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", token: input.secret },
      body: JSON.stringify({ number: input.toE164.replace(/^\+/, ""), text: input.body, track_id: input.messageId, delay: 0 }),
    });
    const result = record(response);
    const providerMessageId = text(result?.messageid) ?? text(result?.messageId) ?? text(result?.id) ?? text(record(result?.key)?.id);
    if (!providerMessageId) throw new RuntimeProviderError("provider_ack_missing", "A Uazapi não devolveu o identificador da mensagem.");
    return { providerMessageId, providerTimestamp: new Date().toISOString() };
  }

  const parsedSecret = z.object({ accessToken: z.string().min(1), appSecret: z.string().min(1) }).parse(JSON.parse(input.secret));
  if (!input.externalPhoneNumberId) throw new RuntimeProviderError("meta_phone_id_missing", "O Phone Number ID da Meta não está configurado.");
  const response = await runtimeFetch(`${input.endpointUrl.replace(/\/$/, "")}/${input.externalPhoneNumberId}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${parsedSecret.accessToken}` },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: input.toE164.replace(/^\+/, ""), type: "text", text: { preview_url: false, body: input.body } }),
  });
  const result = z.object({ messages: z.array(z.object({ id: z.string().min(1) })).min(1) }).safeParse(response);
  if (!result.success) throw new RuntimeProviderError("provider_ack_missing", "A Meta não devolveu o identificador da mensagem.");
  return { providerMessageId: result.data.messages[0].id, providerTimestamp: new Date().toISOString() };
}

export function parseMetaSecret(secret: string) {
  return z.object({ accessToken: z.string().min(1), appSecret: z.string().min(1) }).parse(JSON.parse(secret));
}
