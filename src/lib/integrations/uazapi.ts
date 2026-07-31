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
