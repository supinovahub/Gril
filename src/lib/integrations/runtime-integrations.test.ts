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

  it("preserva os localizadores autenticados de mídia Meta", () => {
    const normalized = normalizeMetaWebhook({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: {
      messages: [{ id: "wamid.image", from: "5511999999999", type: "image", image: { id: "media-1", mime_type: "image/jpeg", sha256: "abc", caption: "planta" } }],
    } }] }] });
    expect(normalized.inbound[0]).toMatchObject({ contentType: "image", body: "planta", media: { providerMediaId: "media-1", mimeType: "image/jpeg", sha256: "abc" } });
  });

  it("normaliza reação Meta como mutação ligada à mensagem original", () => {
    const normalized = normalizeMetaWebhook({ object: "whatsapp_business_account", entry: [{ changes: [{ value: {
      messages: [{ id: "wamid.reaction", from: "5511999999999", timestamp: "1700000000", type: "reaction", reaction: { message_id: "wamid.question", emoji: "👍" } }],
    } }] }] });
    expect(normalized.inbound).toHaveLength(0);
    expect(normalized.mutations[0]).toMatchObject({ kind: "reaction", targetProviderMessageId: "wamid.question", emoji: "👍" });
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

  it("normaliza edição Uazapi sem criar uma segunda mensagem bruta", () => {
    const update = verifyAndNormalizeUazapiWebhook(
      { EventType: "messages_update", token: "token-seguro", message: { messageid: "2", sender: "5511999999999", messageTimestamp: 1700000001000, text: "Texto corrigido" } },
      "token-seguro",
    );
    expect(update?.inbound).toHaveLength(0);
    expect(update?.mutations[0]).toMatchObject({ kind: "edit", targetProviderMessageId: "2", body: "Texto corrigido" });
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
    await expect(sendWhatsappText({ provider: "meta_cloud", endpointUrl: "https://graph.facebook.com/v24.0", secret: JSON.stringify({ accessToken: "meta-token", appSecret: "secret" }), externalPhoneNumberId: "12345", toE164: "+5511999999999", body: "não usado", messageId: "message-3", template: { name: "reativacao", language: "pt_BR", parameters: ["Maria"] } })).resolves.toMatchObject({ providerMessageId: "wamid.ack" });
    const templateBody = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body));
    expect(templateBody).toMatchObject({ type: "template", template: { name: "reativacao", language: { code: "pt_BR" } } });
  });

  it("usa Responses API com tool calling estrito", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.store).toBe(false);
      expect(body.tools[0]).toMatchObject({ type: "function", name: "commit_pedro_turn", strict: true });
      expect(body.parallel_tool_calls).toBe(false);
      return Response.json({
        id: "resp_1",
        status: "completed",
        model: "gpt-5.6-sol",
        output: [{
          type: "function_call",
          name: "commit_pedro_turn",
          call_id: "call_1",
          arguments: JSON.stringify({
            outcome: "reply",
            reply: "Oi! Como posso ajudar?",
            escalation: null,
            qualification_updates: [],
            request_project_match: false,
            call_request: null,
            followup_strategy: "none",
            conversation_summary: { summary: "Conversa de teste.", facts: [] },
          }),
        }],
        usage: { input_tokens: 10, output_tokens: 8 },
      });
    }));
    const result = await createPedroResponse({
      apiKey: "sk-test",
      model: "gpt-5.6-sol",
      reasoningEffort: "medium",
      instructions: "Seja breve",
      messages: [{ role: "user", text: "Oi" }],
      businessContext: { qualification_definitions: [] },
    });
    expect(result).toMatchObject({ responseId: "resp_1", outputText: "Oi! Como posso ajudar?", inputTokens: 10, outputTokens: 8 });
  });
});
