import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  readBodyWithinLimit,
  sha256,
  verifyWebhookSecret,
} from "./security";

afterEach(() => {
  delete process.env.GRIL_WEBHOOK_INGEST_SECRET;
});

describe("segurança dos adapters internos", () => {
  it("compara o secret sem aceitar ausente ou parcial", () => {
    process.env.GRIL_WEBHOOK_INGEST_SECRET = "segredo-completo";
    expect(verifyWebhookSecret("segredo-completo")).toBe(true);
    expect(verifyWebhookSecret("segredo")).toBe(false);
    expect(verifyWebhookSecret(null)).toBe(false);
  });

  it("limita o corpo mesmo quando content-length não é enviado", async () => {
    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: "123456",
    });
    request.headers.delete("content-length");
    expect(await readBodyWithinLimit(request, 5)).toBeNull();
  });

  it("lê corpo válido e gera checksum estável", async () => {
    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: '{"ok":true}',
    });
    expect(await readBodyWithinLimit(request, 100)).toBe('{"ok":true}');
    expect(sha256("gril")).toMatch(/^[a-f0-9]{64}$/);
  });
});
