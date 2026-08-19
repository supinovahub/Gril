import { describe, expect, it } from "vitest";

import { formatConversationMessageForAi } from "./conversation-context";

describe("contexto de resposta do WhatsApp", () => {
  it("mantém mensagens comuns sem envelope adicional", () => {
    expect(formatConversationMessageForAi({
      body: "Quero saber mais",
      content_type: "text",
      direction: "inbound",
    })).toBe("Quero saber mais");
  });

  it("explica ao Pedro qual mensagem do atendimento foi citada pelo lead", () => {
    expect(formatConversationMessageForAi(
      { body: "Estes.", content_type: "text", direction: "inbound" },
      {
        body: "Ainda faz sentido considerando entrada de 100k e parcela de até 10k?",
        content_type: "text",
        direction: "outbound",
      },
    )).toBe([
      "Contexto de resposta do WhatsApp:",
      "A mensagem atual responde especificamente à mensagem anterior do atendimento:",
      '"Ainda faz sentido considerando entrada de 100k e parcela de até 10k?"',
      "Mensagem atual:",
      "Estes.",
    ].join("\n"));
  });

  it("preserva o tipo quando a mensagem citada não possui texto", () => {
    expect(formatConversationMessageForAi(
      { body: "Essa", content_type: "text", direction: "inbound" },
      { body: null, content_type: "image", direction: "outbound" },
    )).toContain('"[image]"');
  });
});
