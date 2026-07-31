import "server-only";

import { z } from "zod";

import { normalizePhoneToE164 } from "../crm/phone";
import {
  fetchProviderJson,
  IntegrationProviderError,
  maskCredential,
} from "./provider-http";

const uazapiStatusSchema = z.object({
  instance: z
    .object({
      id: z.string().min(1),
      name: z.string().optional(),
      status: z.enum(["disconnected", "connecting", "connected", "hibernated"]),
      profileName: z.string().optional(),
      owner: z.string().optional(),
    })
    .passthrough(),
  status: z
    .object({
      connected: z.boolean().optional(),
      loggedIn: z.boolean().optional(),
      jid: z
        .object({ user: z.union([z.string(), z.number()]) })
        .passthrough()
        .nullable()
        .optional(),
    })
    .passthrough()
    .optional(),
});

export function normalizeUazapiBaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new IntegrationProviderError(
      "uazapi_url_invalid",
      "Informe uma URL válida da Uazapi.",
    );
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new IntegrationProviderError(
      "uazapi_url_unsafe",
      "Use somente a URL HTTPS raiz do servidor Uazapi.",
    );
  }

  const hostname = url.hostname.toLowerCase();
  const configuredHosts = (process.env.UAZAPI_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  const officialHost = hostname === "uazapi.com" || hostname.endsWith(".uazapi.com");
  if (!officialHost && !configuredHosts.includes(hostname)) {
    throw new IntegrationProviderError(
      "uazapi_host_not_allowed",
      "Esse host Uazapi não está autorizado pela plataforma.",
    );
  }

  return url.origin;
}

export async function validateUazapiCredential(input: {
  baseUrl: string;
  token: string;
}) {
  const baseUrl = normalizeUazapiBaseUrl(input.baseUrl);
  const token = input.token.trim();
  if (token.length < 8) {
    throw new IntegrationProviderError(
      "uazapi_token_invalid",
      "Informe o token completo da instância Uazapi.",
    );
  }

  const startedAt = Date.now();
  const body = await fetchProviderJson(
    `${baseUrl}/instance/status`,
    { headers: { accept: "application/json", token } },
    { providerLabel: "Uazapi" },
  );
  const parsed = uazapiStatusSchema.safeParse(body);
  if (!parsed.success) {
    throw new IntegrationProviderError(
      "uazapi_contract_invalid",
      "A Uazapi respondeu, mas os dados da instância não foram reconhecidos.",
    );
  }

  const connected =
    parsed.data.instance.status === "connected" &&
    parsed.data.status?.connected !== false &&
    parsed.data.status?.loggedIn !== false;
  if (!connected) {
    throw new IntegrationProviderError(
      "uazapi_instance_not_connected",
      "A credencial é válida, mas a instância Uazapi ainda não está conectada ao WhatsApp.",
    );
  }

  const rawPhone =
    parsed.data.status?.jid?.user?.toString() ?? parsed.data.instance.owner ?? "";
  const phoneE164 = normalizePhoneToE164(rawPhone);
  if (!phoneE164) {
    throw new IntegrationProviderError(
      "uazapi_phone_missing",
      "A instância está conectada, mas a Uazapi não informou um telefone válido.",
    );
  }

  return {
    baseUrl,
    token,
    credentialHint: maskCredential(token),
    latencyMs: Date.now() - startedAt,
    externalAccountId: parsed.data.instance.id,
    phoneE164,
    visibleProfileName:
      parsed.data.instance.profileName ?? parsed.data.instance.name ?? "WhatsApp Uazapi",
    metadata: {
      provider_status: parsed.data.instance.status,
      instance_name: parsed.data.instance.name ?? null,
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function firstText(source: Record<string, unknown> | null, keys: string[]) {
  for (const key of keys) if (typeof source?.[key] === "string" && source[key]) return source[key] as string;
  return undefined;
}

export async function createUazapiInstance(input: { baseUrl: string; adminToken: string; name: string; systemName: string }) {
  const baseUrl = normalizeUazapiBaseUrl(input.baseUrl);
  const adminToken = input.adminToken.trim();
  if (adminToken.length < 8) throw new IntegrationProviderError("uazapi_admin_token_invalid", "Informe o admintoken completo do servidor Uazapi.");
  const body = await fetchProviderJson(`${baseUrl}/instance/init`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", admintoken: adminToken },
    body: JSON.stringify({ name: input.name.trim(), systemName: input.systemName.trim(), adminField01: "gril", adminField02: "self-service" }),
  }, { providerLabel: "Uazapi" });
  const root = asRecord(body); const instance = asRecord(root?.instance);
  const token = firstText(instance, ["token", "instanceToken", "instance_token"]) ?? firstText(root, ["token", "instanceToken", "instance_token"]);
  if (!token || token.length < 8) throw new IntegrationProviderError("uazapi_instance_token_missing", "A instância foi criada, mas a Uazapi não devolveu o token no contrato esperado. Consulte o painel do servidor.");
  return { baseUrl, token, instanceId: firstText(instance, ["id", "instanceId"]) ?? firstText(root, ["id", "instanceId"]) };
}

export async function requestUazapiPairing(input: { baseUrl: string; token: string; phone?: string | null }) {
  const baseUrl = normalizeUazapiBaseUrl(input.baseUrl);
  const token = input.token.trim();
  if (token.length < 8) throw new IntegrationProviderError("uazapi_token_invalid", "Informe o token completo da instância Uazapi.");
  const body = await fetchProviderJson(`${baseUrl}/instance/connect`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", token },
    body: JSON.stringify(input.phone ? { phone: input.phone.replace(/\D/g, "") } : {}),
  }, { providerLabel: "Uazapi", maxBytes: 2_000_000 });
  const root = asRecord(body); const instance = asRecord(root?.instance); const status = asRecord(root?.status);
  const pairCode = firstText(instance, ["paircode", "pairCode", "code"]) ?? firstText(root, ["paircode", "pairCode", "code"]);
  const qrCode = firstText(instance, ["qrcode", "qrCode", "qr"]) ?? firstText(status, ["qrcode", "qrCode", "qr"]) ?? firstText(root, ["qrcode", "qrCode", "qr"]);
  if (!pairCode && !qrCode) throw new IntegrationProviderError("uazapi_pairing_missing", "A Uazapi aceitou a solicitação, mas ainda não devolveu QR ou código de pareamento. Aguarde alguns segundos e tente novamente.");
  const qrImage = qrCode ? (qrCode.startsWith("data:image/") || qrCode.startsWith("https://") ? qrCode : `data:image/png;base64,${qrCode}`) : undefined;
  return { baseUrl, pairCode, qrImage };
}

export async function configureUazapiWebhook(input: { baseUrl: string; token: string; callbackUrl: string }) {
  const baseUrl = normalizeUazapiBaseUrl(input.baseUrl);
  const callback = new URL(input.callbackUrl);
  if (callback.protocol !== "https:" || callback.username || callback.password) {
    throw new IntegrationProviderError("uazapi_callback_invalid", "O webhook exige a URL HTTPS pública do deploy final.");
  }
  await fetchProviderJson(`${baseUrl}/webhook`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", token: input.token.trim() },
    body: JSON.stringify({
      enabled: true,
      url: callback.toString(),
      events: ["connection", "messages", "messages_update"],
      excludeMessages: ["fromMeYes", "isGroupYes"],
      addUrlEvents: false,
      addUrlTypesMessages: false,
      action: "add",
    }),
  }, { providerLabel: "Uazapi" });
  return { callbackUrl: callback.toString() };
}
