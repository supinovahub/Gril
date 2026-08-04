export type CallRequest = {
  starts_at: string;
  format: "video" | "phone" | "unknown";
};

type ConversationMessage = { role: "user" | "assistant"; text: string };

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function hasExplicitCallConfirmation(messages: ConversationMessage[]) {
  const recentUserMessages = messages.filter((message) => message.role === "user").slice(-4);
  const latest = normalize(recentUserMessages.at(-1)?.text ?? "");
  const context = normalize(recentUserMessages.map((message) => message.text).join(" \n "));
  const cancelled = /\b(nao quero|nao posso|cancela|cancelar|desmarca|outro dia|deixa pra la)\b/.test(latest);
  const schedulingIntent = /\b(sim|pode|confirmo|confirmado|fechado|combinado|marcar|agendar|agenda|vamos|disponibilidade|disponivel|consigo|serve|prefiro|telefone|video|ligacao)\b/.test(context);
  const time = /\b(?:[01]?\d|2[0-3])(?::[0-5]\d|h(?:[0-5]\d)?)\b/.test(context);
  const date = /\b(hoje|amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo|\d{1,2}[/-]\d{1,2})\b/.test(context);
  return !cancelled && schedulingIntent && time && date;
}

export function validCallRequest(
  request: CallRequest | null,
  messages: ConversationMessage[],
  now = Date.now(),
) {
  if (!request || !hasExplicitCallConfirmation(messages)) return null;
  const startsAt = new Date(request.starts_at);
  const minimum = now + 10 * 60_000;
  const maximum = now + 365 * 24 * 60 * 60_000;
  return Number.isFinite(startsAt.valueOf()) && startsAt.valueOf() > minimum && startsAt.valueOf() < maximum
    ? request
    : null;
}

export function guardUncommittedCallClaim(outputText: string, request: CallRequest | null) {
  if (request) return outputText;
  const claimsReservation = /\b(deixei|ficou|horario|reuniao|conversa)\b.{0,80}\b(solicitad[ao]|separad[ao]|reservad[ao]|agendad[ao]|marcad[ao])\b/i.test(outputText);
  return claimsReservation
    ? "Antes de solicitar esse horário, confirme para mim a data, o horário e se prefere telefone ou vídeo."
    : outputText;
}
