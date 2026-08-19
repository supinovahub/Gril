export type ConversationContextMessage = {
  body: string | null;
  content_type: string;
  direction: string;
};

function messageBody(message: Pick<ConversationContextMessage, "body" | "content_type">) {
  return message.body ?? `[${message.content_type}]`;
}

export function formatConversationMessageForAi(
  message: ConversationContextMessage,
  repliedTo?: ConversationContextMessage | null,
) {
  const currentBody = messageBody(message);
  if (!repliedTo) return currentBody;

  const quotedAuthor = repliedTo.direction === "inbound" ? "lead" : "atendimento";
  return [
    "Contexto de resposta do WhatsApp:",
    `A mensagem atual responde especificamente à mensagem anterior do ${quotedAuthor}:`,
    JSON.stringify(messageBody(repliedTo)),
    "Mensagem atual:",
    currentBody,
  ].join("\n");
}
