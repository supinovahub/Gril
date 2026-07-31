import "server-only";

import { createHmac } from "node:crypto";
import { z } from "zod";

import { normalizePhoneToE164 } from "../crm/phone";
import {
  fetchProviderJson,
  IntegrationProviderError,
  maskCredential,
} from "./provider-http";

const graphId = z.string().trim().regex(/^[0-9]{5,40}$/);
const wabaSchema = z.object({ id: z.string(), name: z.string().optional() }).passthrough();
const phoneListSchema = z.object({
  data: z.array(
    z
      .object({
        id: z.string(),
        display_phone_number: z.string(),
        verified_name: z.string().optional(),
        quality_rating: z.string().optional(),
        code_verification_status: z.string().optional(),
      })
      .passthrough(),
  ),
});

export function metaGraphVersion() {
  const version = process.env.META_GRAPH_API_VERSION?.trim() || "v24.0";
  if (!/^v[0-9]+\.[0-9]+$/.test(version)) {
    throw new IntegrationProviderError(
      "meta_graph_version_invalid",
      "A versão da Graph API configurada na plataforma é inválida.",
    );
  }
  return version;
}

export async function validateMetaCredential(input: {
  accessToken: string;
  appSecret: string;
  wabaId: string;
  phoneNumberId: string;
}) {
  const accessToken = input.accessToken.trim();
  const appSecret = input.appSecret.trim();
  const wabaId = graphId.safeParse(input.wabaId);
  const phoneNumberId = graphId.safeParse(input.phoneNumberId);
  if (
    accessToken.length < 20 ||
    appSecret.length < 8 ||
    !wabaId.success ||
    !phoneNumberId.success
  ) {
    throw new IntegrationProviderError(
      "meta_credentials_invalid",
      "Revise o token, o App Secret, o WABA ID e o Phone Number ID da Meta.",
    );
  }

  const version = metaGraphVersion();
  const proof = createHmac("sha256", appSecret).update(accessToken).digest("hex");
  const headers = { authorization: `Bearer ${accessToken}`, accept: "application/json" };
  const startedAt = Date.now();
  const [wabaBody, phonesBody] = await Promise.all([
    fetchProviderJson(
      `https://graph.facebook.com/${version}/${wabaId.data}?fields=id,name&appsecret_proof=${proof}`,
      { headers },
      { providerLabel: "Meta" },
    ),
    fetchProviderJson(
      `https://graph.facebook.com/${version}/${wabaId.data}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status&appsecret_proof=${proof}`,
      { headers },
      { providerLabel: "Meta" },
    ),
  ]);

  const waba = wabaSchema.safeParse(wabaBody);
  const phones = phoneListSchema.safeParse(phonesBody);
  if (!waba.success || !phones.success) {
    throw new IntegrationProviderError(
      "meta_contract_invalid",
      "A Meta respondeu, mas os ativos da conta não foram reconhecidos.",
    );
  }
  const phone = phones.data.data.find((item) => item.id === phoneNumberId.data);
  if (!phone) {
    throw new IntegrationProviderError(
      "meta_phone_not_in_waba",
      "O Phone Number ID não pertence ao WABA informado ou não está acessível por esse token.",
    );
  }
  const phoneE164 = normalizePhoneToE164(phone.display_phone_number);
  if (!phoneE164) {
    throw new IntegrationProviderError(
      "meta_phone_invalid",
      "A Meta não devolveu um telefone válido para esse Phone Number ID.",
    );
  }

  return {
    baseUrl: `https://graph.facebook.com/${version}`,
    secret: JSON.stringify({ accessToken, appSecret }),
    credentialHint: maskCredential(accessToken),
    latencyMs: Date.now() - startedAt,
    externalAccountId: waba.data.id,
    externalBusinessId: waba.data.id,
    externalPhoneNumberId: phone.id,
    phoneE164,
    visibleProfileName: phone.verified_name ?? waba.data.name ?? "WhatsApp Meta",
    metadata: {
      graph_api_version: version,
      waba_name: waba.data.name ?? null,
      quality_rating: phone.quality_rating ?? null,
      code_verification_status: phone.code_verification_status ?? null,
    },
  };
}
