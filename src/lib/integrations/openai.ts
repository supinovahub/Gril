import "server-only";

import { z } from "zod";

import {
  fetchProviderJson,
  IntegrationProviderError,
  maskCredential,
} from "./provider-http";

const modelsSchema = z.object({
  data: z.array(z.object({ id: z.string().min(1) }).passthrough()),
});

export async function validateOpenAiCredential(apiKeyInput: string) {
  const apiKey = apiKeyInput.trim();
  if (!apiKey.startsWith("sk-") || apiKey.length < 20) {
    throw new IntegrationProviderError(
      "openai_key_invalid",
      "Informe uma chave de API válida da OpenAI.",
    );
  }

  const startedAt = Date.now();
  const body = await fetchProviderJson(
    "https://api.openai.com/v1/models",
    { headers: { authorization: `Bearer ${apiKey}`, accept: "application/json" } },
    { providerLabel: "OpenAI", maxBytes: 2_000_000 },
  );
  const parsed = modelsSchema.safeParse(body);
  if (!parsed.success || parsed.data.data.length === 0) {
    throw new IntegrationProviderError(
      "openai_models_invalid",
      "A OpenAI aceitou a chave, mas não devolveu modelos disponíveis.",
    );
  }

  return {
    apiKey,
    credentialHint: maskCredential(apiKey),
    latencyMs: Date.now() - startedAt,
    modelIds: parsed.data.data.map((model) => model.id),
  };
}
