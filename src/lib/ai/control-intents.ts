export type PedroControlIntent =
  | "privacy_opt_out"
  | "opt_out"
  | "privacy"
  | "sensitive_document"
  | "payment"
  | "wrong_number"
  | "origin_contested"
  | "identity_question"
  | "legal"
  | "fraud"
  | "discrimination"
  | "unsupported_language"
  | "abuse";

type InboundMessage = { body: string | null; content_type: string };

function normalize(value: string | null | undefined) {
  return value?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() ?? "";
}

function matches(body: string, expression: RegExp) {
  return expression.test(body);
}

const OPT_OUT = /\b(stop|parem?|parar (?:de )?(?:falar|mandar|enviar)|nao quero mais (?:mensagens|contato)|nao me mande|nao envie|remova meu numero|descadastrar|sair da lista)\b/;
const PRIVACY = /\b(lgpd|privacidade|meus dados|apagar meus dados|excluir meus dados|como conseguiu meu contato|quais dados (?:voces?|tem))\b/;
const ABUSE = /\b(idiota|imbecil|burro|merda|porra|caralho|vai se foder|filho da puta)\b/;

export function classifyPedroControlIntent(
  message: InboundMessage,
  recentInboundBodies: Array<string | null> = [],
): PedroControlIntent | null {
  const body = normalize(message.body);
  if (message.content_type === "document") return "sensitive_document";

  const optOut = matches(body, OPT_OUT);
  const privacy = matches(body, PRIVACY);
  if (optOut && privacy) return "privacy_opt_out";
  if (optOut) return "opt_out";
  if (privacy) return "privacy";

  if (/\b(falsificar|fraudar|forjar|documento falso|renda falsa|enganar o banco|burlar analise|laranja)\b/.test(body)) return "fraud";
  if (/\b(pix|boleto|dados bancarios|chave pix|comprovante|pagar|pagamento|sinal|reserva financeira)\b/.test(body)) return "payment";
  if (/\b(numero errado|pessoa errada|nao sou (?:o|a|eu|essa pessoa)|esse numero nao e|esse numero nao pertence)\b/.test(body)) return "wrong_number";
  if (/\b(nunca me cadastrei|nao me cadastrei|nao autorizei|nao dei meu contato|de onde tirou meu numero)\b/.test(body)) return "origin_contested";
  if (/\b(voce e (?:uma )?(?:ia|inteligencia artificial|robo|bot)|estou falando com (?:uma )?(?:ia|robo|bot))\b/.test(body)) return "identity_question";
  if (/\b(advogad[oa]|processar|processo judicial|procon|denuncia|acao judicial|medida judicial|crime|ilegal)\b/.test(body)) return "legal";
  if (/\b(nao quero (?:negro|preto|gay|mulher|homem|estrangeiro)|so atenda (?:branco|homem|mulher)|discriminar)\b/.test(body)) return "discrimination";

  const normalizedHistory = recentInboundBodies.map(normalize);
  const abusiveTurns = [body, ...normalizedHistory].filter((item) => ABUSE.test(item)).length;
  if (abusiveTurns >= 3) return "abuse";

  const spanishMarkers = body.match(/\b(hola|quiero|puede|puedes|gracias|vivienda|departamento|comprar|precio)\b/g)?.length ?? 0;
  const englishMarkers = body.match(/\b(hello|please|would|could|looking|property|apartment|house|price|thanks)\b/g)?.length ?? 0;
  if (spanishMarkers >= 3 || englishMarkers >= 3) return "unsupported_language";
  return null;
}
