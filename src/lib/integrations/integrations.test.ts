import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { validateMetaCredential } from "./meta";
import { validateOpenAiCredential } from "./openai";
import { maskCredential } from "./provider-http";
import { normalizeUazapiBaseUrl, requestUazapiPairing, validateUazapiCredential } from "./uazapi";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.META_GRAPH_API_VERSION;
  delete process.env.UAZAPI_ALLOWED_HOSTS;
});

describe("autosserviço de integrações", () => {
  it("mascara credenciais sem devolver o segredo", () => {
    expect(maskCredential("sk-proj-segredo-1234")).toBe("••••1234");
  });

  it("aceita hosts oficiais Uazapi e recusa destinos fora da allowlist", () => {
    expect(normalizeUazapiBaseUrl("https://cliente.uazapi.com/")).toBe(
      "https://cliente.uazapi.com",
    );
    expect(() => normalizeUazapiBaseUrl("http://cliente.uazapi.com")).toThrow(
      "uazapi_url_unsafe",
    );
    expect(() => normalizeUazapiBaseUrl("https://127.0.0.1")).toThrow(
      "uazapi_host_not_allowed",
    );
  });

  it("valida a instância Uazapi pelo endpoint oficial de status", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("token")).toBe("token-seguro-1234");
      return Response.json({
        instance: {
          id: "instance-1",
          name: "Atendimento",
          profileName: "Imobiliária",
          status: "connected",
        },
        status: {
          connected: true,
          loggedIn: true,
          jid: { user: "5511999999999" },
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await validateUazapiCredential({
      baseUrl: "https://cliente.uazapi.com",
      token: "token-seguro-1234",
    });
    expect(result.externalAccountId).toBe("instance-1");
    expect(result.phoneE164).toBe("+5511999999999");
    expect(result.credentialHint).toBe("••••1234");
  });

  it("aceita o JID textual devolvido por servidores Uazapi", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      instance: {
        id: "instance-2",
        name: "Atendimento",
        profileName: "Imobiliária",
        owner: "5511888888888",
        status: "connected",
      },
      status: {
        connected: true,
        loggedIn: true,
        jid: "5511888888888:1@s.whatsapp.net",
      },
    })));

    await expect(validateUazapiCredential({
      baseUrl: "https://cliente.uazapi.com",
      token: "token-seguro-1234",
    })).resolves.toMatchObject({
      externalAccountId: "instance-2",
      phoneE164: "+5511888888888",
    });
  });

  it("solicita QR Code ou pair code sem persistir o token no navegador", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("token")).toBe("token-seguro-1234");
      return Response.json({ instance: { qrcode: "aW1hZ2U=" } });
    }));
    await expect(requestUazapiPairing({ baseUrl: "https://cliente.uazapi.com", token: "token-seguro-1234" }))
      .resolves.toMatchObject({ qrImage: "data:image/png;base64,aW1hZ2U=" });
  });

  it("confirma que o Phone Number ID pertence ao WABA da Meta", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/phone_numbers?")) {
          return Response.json({
            data: [
              {
                id: "12345678901",
                display_phone_number: "+55 11 99999-9999",
                verified_name: "Imobiliária",
                quality_rating: "GREEN",
              },
            ],
          });
        }
        return Response.json({ id: "98765432101", name: "WABA Imobiliária" });
      }),
    );

    const result = await validateMetaCredential({
      accessToken: "EAAB-token-meta-muito-seguro-1234",
      appSecret: "app-secret-meta",
      wabaId: "98765432101",
      phoneNumberId: "12345678901",
    });
    expect(result.phoneE164).toBe("+5511999999999");
    expect(result.externalBusinessId).toBe("98765432101");
    expect(result.secret).toContain("accessToken");
    expect(result.metadata).toMatchObject({ quality_rating: "GREEN" });
  });

  it("valida a chave OpenAI sem realizar uma chamada paga", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        expect(new Headers(init?.headers).get("authorization")).toBe(
          "Bearer sk-proj-chave-valida-1234",
        );
        return Response.json({
          object: "list",
          data: [{ id: "gpt-5.6-sol" }, { id: "gpt-5.6-terra" }],
        });
      }),
    );

    const result = await validateOpenAiCredential("sk-proj-chave-valida-1234");
    expect(result.modelIds).toEqual(["gpt-5.6-sol", "gpt-5.6-terra"]);
    expect(result.credentialHint).toBe("••••1234");
  });
});
