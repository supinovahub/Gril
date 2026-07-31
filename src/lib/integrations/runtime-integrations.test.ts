import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createPedroResponse } from "./openai-runtime";
import {
  normalizeMetaWebhook,
  sendWhatsappText,
  verifyAndNormalizeUazapiWebhook,
  verifyMetaWebhook,
} from "./whatsapp-runtime";

afterEach(() => vi.unstubAllGlobals());

describe("adapters de tráfego real", () => {
  it("valida a assinatura Meta e normaliza mensagem e recibo", () => {
    const raw = JSON.stringify({ ok: true });
    expect(
      verifyMetaWebhook(
        raw,
        "sha256=322bc77012ced85996cf73b01ca29037406e06779925f7b8de123f64fdd16add",
        "app-secret",
      ),
    ).toBe(true);

    const normalized = normalizeMetaWebhook({
      object: "whatsapp_business_account",
      entry: [{
        id: "waba-1",
        changes: [{
          field: "messages",
          value: {
            contacts: [{ profile: { name: "Maria" } }],
            messages: [{ id: "wamid.in", from: "5511999999999", timestamp: "1700000000", type: "text", text: { body: "Olá" } }],
            statuses: [{ id: "wamid.out", status: "delivered", timestamp: "1700000001" }],
          },
        }],
      }],
    });
    expect(normalized.inbound[0]).toMatchObject({ providerMessageId: "wamid.in", fromE164: "+5511999999999", body: "Olá" });
    expect(normalized.statuses[0]).toMatchObject({ providerMessageId: "wamid.out", status: "delivered" });
  });

  it("autentica Uazapi, ignora mensagens próprias e remove o token do payload", () => {
    const own = verifyAndNormalizeUazapiWebhook(
      { EventType: "messages", token: "token-seguro", message: { messageid: "1", sender: "5511999999999", fromMe: true, text: "eco" } },
      "token-seguro",
    );
    expect(own?.inbound).toHaveLength(0);
    expect(verifyAndNormalizeUazapiWebhook({ token: "errado" }, "token-seguro")).toBeNull();

    const inbound = verifyAndNormalizeUazapiWebhook(
      { EventType: "messages", token: "token-seguro", message: { messageid: "2", sender: "5511999999999", senderName: "João", messageType: "text", messageTimestamp: 1700000000000, text: "Quero saber mais" } },
      "token-seguro",
    );
    expect(inbound?.inbound[0]).toMatchObject({ providerMessageId: "2", fromE164: "+5511999999999", body: "Quero saber mais" });
    expect(JSON.stringify(inbound?.inbound[0].rawPayload)).not.toContain("token-seguro");
  });

  it("envia texto com os contratos oficiais de Uazapi e Meta", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("uazapi")) {
        expect(new Headers(init?.headers).get("token")).toBe("uaz-token");
        expect(JSON.parse(String(init?.body))).toMatchObject({ number: "5511999999999", track_id: "message-1" });
        return Response.json({ messageid: "uaz-ack" });
      }
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer meta-token");
      expect(JSON.parse(String(init?.body))).toMatchObject({ messaging_product: "whatsapp", to: "5511999999999" });
      return Response.json({ messages: [{ id: "wamid.ack" }] });
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendWhatsappText({ provider: "uazapi", endpointUrl: "https://cliente.uazapi.com", secret: "uaz-token", toE164: "+5511999999999", body: "Oi", messageId: "message-1" })).resolves.toMatchObject({ providerMessageId: "uaz-ack" });
    await expect(sendWhatsappText({ provider: "meta_cloud", endpointUrl: "https://graph.facebook.com/v24.0", secret: JSON.stringify({ accessToken: "meta-token", appSecret: "secret" }), externalPhoneNumberId: "12345", toE164: "+5511999999999", body: "Oi", messageId: "message-2" })).resolves.toMatchObject({ providerMessageId: "wamid.ack" });
  });

  it("usa Responses API com Structured Outputs estritos", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.store).toBe(false);
      expect(body.text.format).toMatchObject({ type: "json_schema", strict: true });
      return Response.json({
        id: "resp_1",
        status: "completed",
        model: "gpt-5.6-sol",
        output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ action: "reply", reply: "Oi! Como posso ajudar?", escalation_reason: null }) }] }],
        usage: { input_tokens: 10, output_tokens: 8 },
      });
    }));
    const result = await createPedroResponse({ apiKey: "sk-test", model: "gpt-5.6-sol", reasoningEffort: "medium", instructions: "Seja breve", messages: [{ role: "user", text: "Oi" }] });
    expect(result).toMatchObject({ responseId: "resp_1", outputText: "Oi! Como posso ajudar?", inputTokens: 10, outputTokens: 8 });
  });
});
