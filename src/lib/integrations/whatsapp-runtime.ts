import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
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
  media?: {
    providerMediaId?: string;
    sourceUrl?: string;
    mimeType?: string;
    fileName?: string;
    sha256?: string;
  };
  rawPayload: Json;
};

export type NormalizedStatusUpdate = {
  providerMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  providerTimestamp?: string;
  errorRedacted?: string;
};

export type NormalizedMessageMutation = {
  externalEventId: string;
  targetProviderMessageId: string;
  kind: "edit" | "delete" | "reaction";
  body?: string;
  emoji?: string;
  providerTimestamp?: string;
};

export type NormalizedWhatsappWebhook = {
  inbound: NormalizedInboundMessage[];
  externalOutbound: NormalizedInboundMessage[];
  statuses: NormalizedStatusUpdate[];
  mutations: NormalizedMessageMutation[];
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
  const externalOutbound: NormalizedInboundMessage[] = [];
  const statuses: NormalizedStatusUpdate[] = [];
  const mutations: NormalizedMessageMutation[] = [];
  if (!root || root.object !== "whatsapp_business_account" || !Array.isArray(root.entry)) {
    return { inbound, externalOutbound, statuses, mutations };
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
          if (messageType === "reaction") {
            const reaction = record(message.reaction); const target = text(reaction?.message_id); const emoji = text(reaction?.emoji);
            if (target && emoji) mutations.push({ externalEventId: `${providerMessageId}:reaction:${target}:${emoji}`, targetProviderMessageId: target, kind: "reaction", emoji, providerTimestamp: timestampFromSeconds(message.timestamp) });
            continue;
          }
          const contentType = mapContentType(messageType);
          const textBody = text(record(message.text)?.body);
          const mediaObject = record(message[messageType ?? ""]);
          const caption = text(mediaObject?.caption);
          inbound.push({
            externalEventId: providerMessageId,
            providerMessageId,
            fromE164,
            contactName,
            contentType,
            body: textBody ?? caption ?? null,
            providerTimestamp: timestampFromSeconds(message.timestamp),
            media: contentType !== "text" ? {
              providerMediaId: text(mediaObject?.id),
              mimeType: text(mediaObject?.mime_type),
              fileName: text(mediaObject?.filename),
              sha256: text(mediaObject?.sha256),
            } : undefined,
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
  return { inbound, externalOutbound, statuses, mutations };
}

function findUazapiMessage(root: Record<string, unknown>) {
  const data = record(root.data);
  return record(root.message) ?? record(data?.message) ?? data ?? root;
}

function uazapiMessagePhone(message: Record<string, unknown>) {
  const candidates = [
    text(message.chatid),
    text(message.sender_pn),
    text(message.from),
    text(message.sender),
  ];
  for (const candidate of candidates) {
    if (!candidate || candidate.endsWith("@lid") || candidate.endsWith("@g.us")) continue;
    const normalized = normalizePhoneToE164(candidate);
    if (normalized) return normalized;
  }
  return null;
}

function uazapiInstanceId(root: Record<string, unknown>) {
  const instance = record(root.instance);
  const data = record(root.data);
  const dataInstance = record(data?.instance);
  return text(root.instance)
    ?? text(instance?.id)
    ?? text(instance?.instanceId)
    ?? text(root.instanceId)
    ?? text(root.InstanceId)
    ?? text(data?.instance)
    ?? text(dataInstance?.id)
    ?? text(dataInstance?.instanceId);
}

function fallbackUazapiMessageId(
  root: Record<string, unknown>,
  message: Record<string, unknown>,
) {
  const eventType = text(root.EventType) ?? text(root.event) ?? text(root.type);
  const instanceId = uazapiInstanceId(root);
  const from = text(message.sender) ?? text(message.from) ?? text(message.chatid);
  const timestamp = message.messageTimestamp ?? message.timestamp;
  const body = text(message.text) ?? text(message.body) ?? text(message.caption);
  if (!instanceId || !from || (!timestamp && !body)) return undefined;
  return `uaz-${createHash("sha256")
    .update(JSON.stringify([instanceId, eventType, from, timestamp ?? null, body ?? null]))
    .digest("hex")}`;
}

export function verifyAndNormalizeUazapiWebhook(
  raw: unknown,
  credential: string,
  headerToken?: string | null,
  expectedInstanceId?: string | readonly string[] | null,
): NormalizedWhatsappWebhook | null {
  const root = record(raw);
  if (!root) return null;
  const receivedToken = text(root.token) ?? headerToken ?? text(record(root.data)?.token);
  if (receivedToken) {
    if (!safeEqual(receivedToken, credential)) return null;
  } else {
    const expectedInstances = typeof expectedInstanceId === "string"
      ? [expectedInstanceId]
      : expectedInstanceId ?? [];
    if (!expectedInstances.includes(uazapiInstanceId(root) ?? "")) return null;
  }

  const inbound: NormalizedInboundMessage[] = [];
  const externalOutbound: NormalizedInboundMessage[] = [];
  const statuses: NormalizedStatusUpdate[] = [];
  const mutations: NormalizedMessageMutation[] = [];
  const eventType = (text(root.EventType) ?? text(root.event) ?? text(root.type) ?? "").toLowerCase();
  const message = findUazapiMessage(root);
  if (!message) return { inbound, externalOutbound, statuses, mutations };
  const providerMessageId = text(message.messageid)
    ?? text(message.messageId)
    ?? text(message.id)
    ?? text(record(message.key)?.id)
    ?? fallbackUazapiMessageId(root, message);
  const fromMe = message.fromMe === true;
  const wasSentByApi = message.wasSentByApi === true;
  const incoming = !fromMe && !wasSentByApi;
  const reaction = record(message.reaction) ?? record(message.reactionMessage);
  const reactionTarget = text(reaction?.messageid) ?? text(reaction?.messageId) ?? text(reaction?.id) ?? text(record(reaction?.key)?.id) ?? text(message.targetMessageId);
  const reactionEmoji = text(reaction?.emoji) ?? text(reaction?.text);
  if (incoming && reactionTarget && reactionEmoji) {
    mutations.push({ externalEventId: `${providerMessageId ?? reactionTarget}:reaction:${reactionEmoji}`, targetProviderMessageId: reactionTarget, kind: "reaction", emoji: reactionEmoji, providerTimestamp: timestampFromSeconds(message.messageTimestamp ?? message.timestamp) });
    return { inbound, externalOutbound, statuses, mutations };
  }

  if (eventType.includes("update") || (!text(message.text) && providerStatus(message.status))) {
    const status = providerStatus(message.status);
    if (providerMessageId && status) {
      statuses.push({
        providerMessageId,
        status,
        providerTimestamp: timestampFromSeconds(message.messageTimestamp ?? message.timestamp),
        errorRedacted: status === "failed" ? "Uazapi informou falha no envio." : undefined,
      });
    } else if (incoming && providerMessageId && (message.deleted === true || eventType.includes("delete") || eventType.includes("revoke"))) {
      mutations.push({ externalEventId: `${providerMessageId}:delete`, targetProviderMessageId: providerMessageId, kind: "delete", providerTimestamp: timestampFromSeconds(message.messageTimestamp ?? message.timestamp) });
    } else if (incoming && providerMessageId && (text(message.text) ?? text(message.body))) {
      const editedBody = text(message.text) ?? text(message.body) ?? "";
      mutations.push({ externalEventId: `${providerMessageId}:edit:${String(message.messageTimestamp ?? message.timestamp ?? editedBody.slice(0,64))}`, targetProviderMessageId: providerMessageId, kind: "edit", body: editedBody, providerTimestamp: timestampFromSeconds(message.messageTimestamp ?? message.timestamp) });
    }
    return { inbound, externalOutbound, statuses, mutations };
  }

  const isGroup = message.isGroup === true || text(message.chatid)?.endsWith("@g.us") === true;
  const fromE164 = uazapiMessagePhone(message);
  const contentType = mapContentType(
    text(message.messageType)
      ?? text(message.type)
      ?? ((text(message.text) ?? text(message.body)) ? "text" : undefined),
  );
  const media = record(message.media) ?? record(message.file) ?? record(message.document) ?? record(message.image) ?? record(message.audio) ?? record(message.video);
  const sourceUrl = text(media?.url) ?? text(media?.URL) ?? text(message.fileURL) ?? text(message.mediaUrl) ?? text(message.url);
  const normalizedMedia = contentType !== "text" ? {
    providerMediaId: text(media?.id) ?? text(message.mediaId),
    sourceUrl,
    mimeType: text(media?.mimetype) ?? text(media?.mimeType) ?? text(message.mimetype),
    fileName: text(media?.fileName) ?? text(media?.filename) ?? text(message.fileName),
    sha256: text(media?.sha256),
  } : undefined;

  if (fromMe && !wasSentByApi && !isGroup && providerMessageId && fromE164) {
    const rootChat = record(root.chat) ?? record(record(root.data)?.chat);
    externalOutbound.push({
      externalEventId: providerMessageId,
      providerMessageId,
      fromE164,
      contactName: text(rootChat?.name) ?? text(rootChat?.wa_name),
      contentType,
      body: text(message.text) ?? text(message.body) ?? text(message.caption) ?? null,
      providerTimestamp: timestampFromSeconds(message.messageTimestamp ?? message.timestamp),
      media: normalizedMedia,
      rawPayload: redactPayload(raw),
    });
  }
  if (incoming && !isGroup && providerMessageId && fromE164) {
    inbound.push({
      externalEventId: providerMessageId,
      providerMessageId,
      fromE164,
      contactName: text(message.senderName) ?? text(message.pushName),
      contentType,
      body: text(message.text) ?? text(message.body) ?? text(message.caption) ?? null,
      providerTimestamp: timestampFromSeconds(message.messageTimestamp ?? message.timestamp),
      media: normalizedMedia,
      rawPayload: redactPayload(raw),
    });
  }
  return { inbound, externalOutbound, statuses, mutations };
}

async function runtimeFetch(
  url: string,
  init: RequestInit,
  options: { idempotent?: boolean } = {},
) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    if (options.idempotent) {
      throw new RuntimeProviderError(
        "provider_unreachable",
        "O provedor não respondeu dentro do limite.",
        true,
      );
    }
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
    const retryable = options.idempotent && response.status >= 500;
    const uncertain = !options.idempotent && response.status >= 500;
    throw new RuntimeProviderError(
      `provider_http_${response.status}`,
      retryable
        ? "O provedor está temporariamente indisponível."
        : uncertain
        ? "O provedor falhou sem confirmar se processou a mensagem; o envio foi interrompido para evitar duplicidade."
        : "O provedor recusou a mensagem.",
      retryable,
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
  template?: { name: string; language: string; parameters: string[] } | null;
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
  const templatePayload = input.template ? {
    messaging_product: "whatsapp", recipient_type: "individual", to: input.toE164.replace(/^\+/, ""), type: "template",
    template: {
      name: input.template.name, language: { code: input.template.language },
      ...(input.template.parameters.length ? { components: [{ type: "body", parameters: input.template.parameters.map((textValue) => ({ type: "text", text: textValue })) }] } : {}),
    },
  } : {
    messaging_product: "whatsapp", recipient_type: "individual", to: input.toE164.replace(/^\+/, ""),
    type: "text", text: { preview_url: false, body: input.body },
  };
  const response = await runtimeFetch(`${input.endpointUrl.replace(/\/$/, "")}/${input.externalPhoneNumberId}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${parsedSecret.accessToken}` },
    body: JSON.stringify(templatePayload),
  });
  const result = z.object({ messages: z.array(z.object({ id: z.string().min(1) })).min(1) }).safeParse(response);
  if (!result.success) throw new RuntimeProviderError("provider_ack_missing", "A Meta não devolveu o identificador da mensagem.");
  return { providerMessageId: result.data.messages[0].id, providerTimestamp: new Date().toISOString() };
}

export async function sendWhatsappMedia(input: {
  provider: WhatsappProvider;
  endpointUrl: string;
  secret: string;
  externalPhoneNumberId?: string | null;
  toE164: string;
  caption?: string;
  messageId: string;
  mediaType: "image" | "document";
  mediaUrl: string;
  mimeType: string;
  fileName?: string;
}) {
  const mediaUrl = new URL(input.mediaUrl);
  if (mediaUrl.protocol !== "https:") {
    throw new RuntimeProviderError("approved_media_url_unsafe", "A URL temporária da mídia não usa HTTPS.");
  }
  if (input.mediaType === "image" && !["image/jpeg", "image/png"].includes(input.mimeType)) {
    throw new RuntimeProviderError("approved_image_type_invalid", "A imagem aprovada não é JPEG ou PNG.");
  }
  if (input.mediaType === "document" && input.mimeType !== "application/pdf") {
    throw new RuntimeProviderError("approved_document_type_invalid", "O documento aprovado não é PDF.");
  }

  if (input.provider === "uazapi") {
    const response = await runtimeFetch(`${input.endpointUrl.replace(/\/$/, "")}/send/media`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", token: input.secret },
      body: JSON.stringify({
        number: input.toE164.replace(/^\+/, ""),
        type: input.mediaType,
        file: input.mediaUrl,
        ...(input.caption ? { text: input.caption.slice(0, 1024) } : {}),
        ...(input.mediaType === "document" ? {
          docName: (input.fileName || "book.pdf").slice(0, 120),
          mimetype: input.mimeType,
        } : {}),
        track_id: input.messageId,
      }),
    });
    const result = record(response);
    const providerMessageId = text(result?.messageid) ?? text(result?.messageId) ?? text(result?.id) ?? text(record(result?.key)?.id);
    if (!providerMessageId) throw new RuntimeProviderError("provider_ack_missing", "A Uazapi não devolveu o identificador da mídia.");
    return { providerMessageId, providerTimestamp: new Date().toISOString() };
  }

  const parsedSecret = parseMetaSecret(input.secret);
  if (!input.externalPhoneNumberId) throw new RuntimeProviderError("meta_phone_id_missing", "O Phone Number ID da Meta não está configurado.");
  const media = input.mediaType === "image"
    ? { link: input.mediaUrl, ...(input.caption ? { caption: input.caption.slice(0, 1024) } : {}) }
    : { link: input.mediaUrl, filename: (input.fileName || "book.pdf").slice(0, 120), ...(input.caption ? { caption: input.caption.slice(0, 1024) } : {}) };
  const response = await runtimeFetch(`${input.endpointUrl.replace(/\/$/, "")}/${input.externalPhoneNumberId}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${parsedSecret.accessToken}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.toE164.replace(/^\+/, ""),
      type: input.mediaType,
      [input.mediaType]: media,
    }),
  });
  const result = z.object({ messages: z.array(z.object({ id: z.string().min(1) })).min(1) }).safeParse(response);
  if (!result.success) throw new RuntimeProviderError("provider_ack_missing", "A Meta não devolveu o identificador da mídia.");
  return { providerMessageId: result.data.messages[0].id, providerTimestamp: new Date().toISOString() };
}

async function downloadBinary(url: string, headers: HeadersInit) {
  let response: Response;
  try {
    response = await fetch(url, { headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new RuntimeProviderError("media_download_failed", "O provedor não entregou a mídia para processamento.", true);
  }
  if (!response.ok) throw new RuntimeProviderError(`media_http_${response.status}`, "O provedor recusou o download da mídia.", response.status === 429 || response.status >= 500);
  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > 20 * 1024 * 1024) throw new RuntimeProviderError("media_too_large", "A mídia excede o limite de 20 MB.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 20 * 1024 * 1024) throw new RuntimeProviderError("media_too_large", "A mídia excede o limite de 20 MB.");
  return { bytes, mimeType: response.headers.get("content-type")?.split(";")[0] };
}

export async function downloadWhatsappMedia(input: {
  provider: WhatsappProvider;
  endpointUrl: string;
  secret: string;
  providerMediaId?: string | null;
  sourceUrl?: string | null;
}) {
  if (input.provider === "meta_cloud") {
    if (!input.providerMediaId) throw new RuntimeProviderError("meta_media_id_missing", "A Meta não informou o identificador da mídia.");
    const parsedSecret = parseMetaSecret(input.secret);
    const metadata = await runtimeFetch(
      `${input.endpointUrl.replace(/\/$/, "")}/${encodeURIComponent(input.providerMediaId)}`,
      { headers: { accept: "application/json", authorization: `Bearer ${parsedSecret.accessToken}` } },
      { idempotent: true },
    );
    const mediaUrl = text(record(metadata)?.url);
    if (!mediaUrl) throw new RuntimeProviderError("meta_media_url_missing", "A Meta não devolveu a URL temporária da mídia.");
    return downloadBinary(mediaUrl, { authorization: `Bearer ${parsedSecret.accessToken}` });
  }
  if (!input.sourceUrl) throw new RuntimeProviderError("uazapi_media_url_missing", "A Uazapi não informou a URL da mídia.");
  const mediaUrl = new URL(input.sourceUrl);
  const endpoint = new URL(input.endpointUrl);
  const allowedHosts = new Set([
    endpoint.hostname.toLowerCase(),
    ...(process.env.UAZAPI_ALLOWED_HOSTS ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean),
  ]);
  if (mediaUrl.protocol !== "https:" || (!allowedHosts.has(mediaUrl.hostname.toLowerCase()) && !mediaUrl.hostname.toLowerCase().endsWith(".uazapi.com"))) {
    throw new RuntimeProviderError("uazapi_media_url_unsafe", "A Uazapi informou uma origem de mídia não autorizada.");
  }
  return downloadBinary(mediaUrl.toString(), { token: input.secret });
}

export function parseMetaSecret(secret: string) {
  return z.object({ accessToken: z.string().min(1), appSecret: z.string().min(1) }).parse(JSON.parse(secret));
}
