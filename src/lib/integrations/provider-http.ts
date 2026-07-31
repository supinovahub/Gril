import "server-only";

export class IntegrationProviderError extends Error {
  constructor(
    public readonly code: string,
    public readonly userMessage: string,
  ) {
    super(code);
    this.name = "IntegrationProviderError";
  }
}

export function maskCredential(value: string) {
  const normalized = value.trim();
  return `••••${normalized.slice(-4)}`;
}

export async function fetchProviderJson(
  input: string,
  init: RequestInit,
  options: {
    timeoutMs?: number;
    maxBytes?: number;
    providerLabel: string;
  },
) {
  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? 12_000),
    });
  } catch {
    throw new IntegrationProviderError(
      "provider_unreachable",
      `${options.providerLabel} não respondeu. Confirme a URL e tente novamente.`,
    );
  }

  const raw = await response.text();
  if (new TextEncoder().encode(raw).byteLength > (options.maxBytes ?? 1_000_000)) {
    throw new IntegrationProviderError(
      "provider_response_too_large",
      `${options.providerLabel} devolveu uma resposta inesperada.`,
    );
  }

  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      throw new IntegrationProviderError(
        "provider_invalid_json",
        `${options.providerLabel} devolveu uma resposta inválida.`,
      );
    }
  }

  if (!response.ok) {
    const message =
      response.status === 401 || response.status === 403
        ? `A credencial da ${options.providerLabel} foi recusada.`
        : `Não foi possível validar a ${options.providerLabel} agora.`;
    throw new IntegrationProviderError(`provider_http_${response.status}`, message);
  }

  return body;
}
