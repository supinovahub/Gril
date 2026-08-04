export type CallRequest = {
  starts_at: string;
  format: "video" | "phone" | "unknown";
};

type ConversationMessage = { role: "user" | "assistant"; text: string };

export type AvailableCallSlot = {
  starts_at: string;
  available_members: number;
};

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

export function isSchedulingAvailabilityRequest(messages: ConversationMessage[]) {
  const latest = normalize(messages.filter((message) => message.role === "user").at(-1)?.text ?? "");
  return /\b(disponibilidade|disponivel|horarios?|agenda|quando\s+(?:pode|consegue)|hoje\s+(?:a\s+)?(?:tarde|noite)|amanha)\b/.test(latest);
}

export function buildSchedulingAvailabilityReply(
  slots: AvailableCallSlot[],
  timezone = "America/Sao_Paulo",
) {
  if (slots.length === 0) {
    return "Não encontrei um horário livre nesse período. Qual outro dia ou faixa de horário funciona melhor pra você?";
  }
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const options = slots.slice(0, 3).map((slot) => formatter.format(new Date(slot.starts_at)));
  const joined = options.length === 1
    ? options[0]
    : `${options.slice(0, -1).join(", ")} ou ${options.at(-1)}`;
  return `Tenho sim. Posso ${joined}. Qual desses horários fica melhor pra você?`;
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
