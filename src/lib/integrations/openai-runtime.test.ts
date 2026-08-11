import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createPedroResponse, OpenAiRuntimeError } from "./openai-runtime";

const validTurn = {
  outcome: "reply",
  reply: "Vou separar algumas opções para você.",
  escalation: null,
  qualification_updates: [],
  request_project_match: false,
  recommended_project_ids: [],
  project_media_requests: [],
  call_request: null,
  followup_strategy: "none",
  conversation_summary: { summary: "O lead pediu opções.", facts: [] },
};

function openAiResponse(argumentsValue: string, id: string) {
  return new Response(JSON.stringify({
    id,
    status: "completed",
    model: "gpt-5.6-terra",
    output: [{
      type: "function_call",
      name: "commit_pedro_turn",
      call_id: `call_${id}`,
      arguments: argumentsValue,
    }],
    usage: { input_tokens: 10, output_tokens: 20 },
  }), { status: 200, headers: { "content-type": "application/json" } });
}

describe("createPedroResponse", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("corrige uma decisão estruturada inválida uma vez antes de falhar", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(openAiResponse(JSON.stringify({ ...validTurn, outcome: "invalid" }), "resp_invalid"))
      .mockResolvedValueOnce(openAiResponse(JSON.stringify(validTurn), "resp_valid"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createPedroResponse({
      apiKey: "test-key",
      model: "gpt-5.6-terra",
      instructions: "Responda ao lead.",
      messages: [{ role: "user", text: "O que você teria de opção?" }],
      businessContext: { organization: "test" },
    });

    expect(result.responseId).toBe("resp_valid");
    expect(result.structured).toEqual(validTurn);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondRequest = fetchMock.mock.calls[1][1] as RequestInit;
    expect(JSON.parse(String(secondRequest.body)).instructions).toContain("CONTROLE DE FORMATO");
  });

  it("não libera decisão depois de duas respostas estruturadas inválidas", async () => {
    const fetchMock = vi.fn()
      .mockImplementation(() => Promise.resolve(openAiResponse(
        JSON.stringify({ ...validTurn, outcome: "invalid" }),
        "resp_invalid",
      )));
    vi.stubGlobal("fetch", fetchMock);

    const execution = createPedroResponse({
      apiKey: "test-key",
      model: "gpt-5.6-terra",
      instructions: "Responda ao lead.",
      messages: [{ role: "user", text: "O que você teria de opção?" }],
      businessContext: { organization: "test" },
    });

    await expect(execution).rejects.toMatchObject<Partial<OpenAiRuntimeError>>({
      code: "openai_tool_arguments_invalid",
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
