import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createPedroResponse } from "./openai-runtime";
import {
  downloadWhatsappMedia,
  normalizeMetaWebhook,
  sendWhatsappMedia,
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

  it("autentica Uazapi, separa mensagem manual do celular e remove o token do payload", () => {
    const own = verifyAndNormalizeUazapiWebhook(
      { EventType: "messages", token: "token-seguro", chat: { name: "João" }, message: { messageid: "1", chatid: "5511999999999@s.whatsapp.net", fromMe: true, wasSentByApi: false, text: "mensagem pelo celular" } },
      "token-seguro",
    );
    expect(own?.inbound).toHaveLength(0);
    expect(own?.externalOutbound[0]).toMatchObject({
      providerMessageId: "1",
      fromE164: "+5511999999999",
      contactName: "João",
      body: "mensagem pelo celular",
    });

    const apiEcho = verifyAndNormalizeUazapiWebhook(
      { EventType: "messages", token: "token-seguro", message: { messageid: "api-1", chatid: "5511999999999@s.whatsapp.net", fromMe: true, wasSentByApi: true, text: "eco" } },
      "token-seguro",
    );
    expect(apiEcho?.externalOutbound).toHaveLength(0);
    const apiEchoWithoutFromMe = verifyAndNormalizeUazapiWebhook(
      { EventType: "messages", token: "token-seguro", message: { messageid: "api-2", chatid: "5511999999999@s.whatsapp.net", wasSentByApi: true, text: "eco" } },
      "token-seguro",
    );
    expect(apiEchoWithoutFromMe?.inbound).toHaveLength(0);
    expect(apiEchoWithoutFromMe?.externalOutbound).toHaveLength(0);
    expect(verifyAndNormalizeUazapiWebhook({ token: "errado" }, "token-seguro")).toBeNull();

    const inbound = verifyAndNormalizeUazapiWebhook(
      { EventType: "messages", token: "token-seguro", message: { messageid: "2", sender: "5511999999999", senderName: "João", messageType: "text", messageTimestamp: 1700000000000, text: "Quero saber mais" } },
      "token-seguro",
    );
    expect(inbound?.inbound[0]).toMatchObject({ providerMessageId: "2", fromE164: "+5511999999999", body: "Quero saber mais" });
    expect(JSON.stringify(inbound?.inbound[0].rawPayload)).not.toContain("token-seguro");
  });

  it("aceita o callback Uazapi sem token quando a instância confere", () => {
    const inbound = verifyAndNormalizeUazapiWebhook(
      {
        event: "message.received",
        instance: "instance-1",
        data: {
          from: "5511999999999",
          body: "Olá pelo webhook",
          timestamp: 1_700_000_000,
        },
      },
      "token-seguro",
      null,
      "instance-1",
    );

    expect(inbound?.inbound[0]).toMatchObject({
      fromE164: "+5511999999999",
      contentType: "text",
      body: "Olá pelo webhook",
    });
    expect(inbound?.inbound[0].providerMessageId).toMatch(/^uaz-[a-f0-9]{64}$/);
    expect(
      verifyAndNormalizeUazapiWebhook(
        { event: "message.received", instance: "outra", data: { from: "5511999999999", body: "Oi" } },
        "token-seguro",
        null,
        "instance-1",
      ),
    ).toBeNull();
  });

  it("usa sender_pn quando a Uazapi entrega o remetente como LID", () => {
    const inbound = verifyAndNormalizeUazapiWebhook(
      {
        EventType: "messages",
        instanceName: "instance-1",
        token: "token-seguro",
        message: {
          messageid: "3EB0REAL",
          sender: "123456789012345@lid",
          sender_lid: "123456789012345@lid",
          sender_pn: "5511999999999@s.whatsapp.net",
          chatid: "5511999999999@s.whatsapp.net",
          fromMe: false,
          isGroup: false,
          messageType: "Conversation",
          messageTimestamp: 1_700_000_000,
          text: "Mensagem real",
        },
      },
      "token-seguro",
    );

    expect(inbound?.inbound[0]).toMatchObject({
      providerMessageId: "3EB0REAL",
      fromE164: "+5511999999999",
      contentType: "text",
      body: "Mensagem real",
    });
  });

  it("normaliza edição Uazapi sem criar uma segunda mensagem bruta", () => {
    const update = verifyAndNormalizeUazapiWebhook(
      { EventType: "messages_update", token: "token-seguro", message: { messageid: "2", sender: "5511999999999", messageTimestamp: 1700000001000, text: "Texto corrigido" } },
      "token-seguro",
    );
    expect(update?.inbound).toHaveLength(0);
    expect(update?.mutations[0]).toMatchObject({ kind: "edit", targetProviderMessageId: "2", body: "Texto corrigido" });
  });

  it("normaliza falhas e recibos Uazapi sem expor dados do provedor", () => {
    const update = verifyAndNormalizeUazapiWebhook(
      {
        EventType: "messages_update",
        token: "token-seguro",
        message: {
          messageid: "uaz-out-1",
          status: "failed",
          messageTimestamp: 1700000001000,
          authorization: "Bearer segredo-interno",
        },
      },
      "token-seguro",
    );
    expect(update?.statuses[0]).toMatchObject({
      providerMessageId: "uaz-out-1",
      status: "failed",
      errorRedacted: "Uazapi informou falha no envio.",
    });
    expect(JSON.stringify(update)).not.toContain("segredo-interno");
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

  it("envia imagens e books aprovados sem permitir áudio no contrato", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (url.includes("uazapi")) {
        expect(body).toMatchObject({
          number: "5511999999999",
          type: "image",
          file: "https://storage.example/principal.jpg",
          track_id: "media-1",
        });
        return Response.json({ messageid: "uaz-media" });
      }
      expect(body).toMatchObject({
        messaging_product: "whatsapp",
        type: "document",
        document: {
          link: "https://storage.example/book.pdf",
          filename: "book.pdf",
        },
      });
      return Response.json({ messages: [{ id: "wamid.media" }] });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendWhatsappMedia({
      provider: "uazapi", endpointUrl: "https://cliente.uazapi.com", secret: "uaz-token",
      toE164: "+5511999999999", caption: "Foto principal", messageId: "media-1",
      mediaType: "image", mediaUrl: "https://storage.example/principal.jpg", mimeType: "image/jpeg",
    })).resolves.toMatchObject({ providerMessageId: "uaz-media" });
    await expect(sendWhatsappMedia({
      provider: "meta_cloud", endpointUrl: "https://graph.facebook.com/v24.0",
      secret: JSON.stringify({ accessToken: "meta-token", appSecret: "secret" }), externalPhoneNumberId: "12345",
      toE164: "+5511999999999", caption: "Book completo", messageId: "media-2",
      mediaType: "document", mediaUrl: "https://storage.example/book.pdf", mimeType: "application/pdf", fileName: "book.pdf",
    })).resolves.toMatchObject({ providerMessageId: "wamid.media" });
  });

  it("marca 429 como repetível, sem classificar o envio como incerto", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "limit" }), { status: 429 })));
    await expect(sendWhatsappText({
      provider: "uazapi",
      endpointUrl: "https://cliente.uazapi.com",
      secret: "uaz-token-supersecreto",
      toE164: "+5511999999999",
      body: "Oi",
      messageId: "message-rate-limit",
    })).rejects.toMatchObject({
      code: "provider_rate_limited",
      retryable: true,
      uncertain: false,
    });
  });

  it("não reenvia cegamente quando timeout ou 5xx deixam o envio incerto", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("socket timeout com uaz-token-supersecreto");
    }));
    const timedOut = sendWhatsappText({
      provider: "uazapi",
      endpointUrl: "https://cliente.uazapi.com",
      secret: "uaz-token-supersecreto",
      toE164: "+5511999999999",
      body: "Oi",
      messageId: "message-timeout",
    });
    await expect(timedOut).rejects.toMatchObject({
      code: "provider_send_uncertain",
      retryable: false,
      uncertain: true,
      redactedMessage: expect.not.stringContaining("uaz-token-supersecreto"),
    });

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "upstream" }), { status: 503 })));
    await expect(sendWhatsappText({
      provider: "uazapi",
      endpointUrl: "https://cliente.uazapi.com",
      secret: "uaz-token-supersecreto",
      toE164: "+5511999999999",
      body: "Oi",
      messageId: "message-503",
    })).rejects.toMatchObject({ code: "provider_http_503", retryable: false, uncertain: true });
  });

  it("trata 4xx de envio como falha permanente e mantém o segredo fora do erro", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "token uaz-token-supersecreto" }), { status: 400 })));
    await expect(sendWhatsappText({
      provider: "uazapi",
      endpointUrl: "https://cliente.uazapi.com",
      secret: "uaz-token-supersecreto",
      toE164: "+5511999999999",
      body: "Oi",
      messageId: "message-invalid",
    })).rejects.toMatchObject({
      code: "provider_http_400",
      retryable: false,
      uncertain: false,
      redactedMessage: expect.not.stringContaining("uaz-token-supersecreto"),
    });
  });

  it("baixa mídia Meta autenticada e permite repetir falha transitória de leitura", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ url: "https://lookaside.facebook.com/media-1" }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/jpeg", "content-length": "3" },
      }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(downloadWhatsappMedia({
      provider: "meta_cloud",
      endpointUrl: "https://graph.facebook.com/v24.0",
      secret: JSON.stringify({ accessToken: "meta-token", appSecret: "meta-secret" }),
      providerMediaId: "media-1",
    })).resolves.toMatchObject({ bytes: new Uint8Array([1, 2, 3]), mimeType: "image/jpeg" });
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("authorization")).toBe("Bearer meta-token");

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "temporary" }), { status: 503 })));
    await expect(downloadWhatsappMedia({
      provider: "meta_cloud",
      endpointUrl: "https://graph.facebook.com/v24.0",
      secret: JSON.stringify({ accessToken: "meta-token", appSecret: "meta-secret" }),
      providerMediaId: "media-1",
    })).rejects.toMatchObject({ code: "provider_http_503", retryable: true, uncertain: false });
  });

  it("recusa mídia Uazapi hospedada fora das origens autorizadas", async () => {
    await expect(downloadWhatsappMedia({
      provider: "uazapi",
      endpointUrl: "https://cliente.uazapi.com",
      secret: "uaz-token",
      sourceUrl: "https://atacante.example/arquivo.pdf",
    })).rejects.toMatchObject({ code: "uazapi_media_url_unsafe", retryable: false });
  });

  it("usa Responses API com tool calling estrito", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.store).toBe(false);
      expect(body.tools[0]).toMatchObject({ type: "function", name: "commit_pedro_turn", strict: true });
      expect(body.parallel_tool_calls).toBe(false);
      expect(body.input.slice(0, 3)).toEqual([
        { role: "user", content: "Oi" },
        { role: "assistant", content: "Olá! Como posso ajudar?" },
        { role: "user", content: "Quero um imóvel no Centro." },
      ]);
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
            project_media_request: null,
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
      messages: [
        { role: "user", text: "Oi" },
        { role: "assistant", text: "Olá! Como posso ajudar?" },
        { role: "user", text: "Quero um imóvel no Centro." },
      ],
      businessContext: { qualification_definitions: [] },
    });
    expect(result).toMatchObject({ responseId: "resp_1", outputText: "Oi! Como posso ajudar?", inputTokens: 10, outputTokens: 8 });
  });

  it("classifica 429 e 5xx da OpenAI como repetíveis, mas não repete 401", async () => {
    const input = {
      apiKey: "sk-segredo-nao-pode-vazar",
      model: "gpt-5.6-sol",
      instructions: "Seja breve",
      messages: [{ role: "user" as const, text: "Oi" }],
      businessContext: {},
    };
    for (const status of [429, 503]) {
      vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: input.apiKey } }), { status })));
      await expect(createPedroResponse(input)).rejects.toMatchObject({
        code: `openai_http_${status}`,
        retryable: true,
        redactedMessage: expect.not.stringContaining(input.apiKey),
      });
    }
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: input.apiKey } }), { status: 401 })));
    await expect(createPedroResponse(input)).rejects.toMatchObject({
      code: "openai_http_401",
      retryable: false,
      redactedMessage: expect.not.stringContaining(input.apiKey),
    });
  });

  it("rejeita decisão OpenAI fora do contrato estruturado", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      id: "resp_invalid",
      status: "completed",
      output: [{
        type: "function_call",
        name: "commit_pedro_turn",
        call_id: "call_invalid",
        arguments: JSON.stringify({ outcome: "reply", reply: null }),
      }],
    })));
    await expect(createPedroResponse({
      apiKey: "sk-test",
      model: "gpt-5.6-sol",
      instructions: "Seja breve",
      messages: [{ role: "user", text: "Oi" }],
      businessContext: {},
    })).rejects.toMatchObject({ code: "openai_tool_arguments_invalid", retryable: false });
  });
});
