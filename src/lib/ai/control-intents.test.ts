import { describe, expect, it } from "vitest";

import { classifyPedroControlIntent } from "./control-intents";

describe("classifyPedroControlIntent", () => {
  it("não trata cancelamento de call como opt-out", () => {
    expect(classifyPedroControlIntent({ body: "Quero cancelar a call de amanhã", content_type: "text" })).toBeNull();
  });

  it("prioriza pedido combinado de privacidade e opt-out", () => {
    expect(classifyPedroControlIntent({ body: "Parem de mandar mensagens e apaguem meus dados pela LGPD", content_type: "text" }))
      .toBe("privacy_opt_out");
  });

  it("escalona fraude e abuso recorrente", () => {
    expect(classifyPedroControlIntent({ body: "Você consegue forjar um comprovante de renda?", content_type: "text" })).toBe("fraud");
    expect(classifyPedroControlIntent(
      { body: "Seu idiota", content_type: "text" },
      ["Que merda", "Vai se foder"],
    )).toBe("abuse");
  });

  it("identifica conversa predominantemente em idioma não suportado", () => {
    expect(classifyPedroControlIntent({ body: "Hello, I am looking for an apartment, please", content_type: "text" }))
      .toBe("unsupported_language");
  });

  it("não confunde desconhecimento da região com número errado", () => {
    expect(classifyPedroControlIntent({ body: "não conheço nada aí de São Paulo", content_type: "text" }))
      .toBeNull();
    expect(classifyPedroControlIntent({ body: "vocês falaram com a pessoa errada", content_type: "text" }))
      .toBe("wrong_number");
  });
});
