import { redirect } from "next/navigation";

import { InternalChatWorkspace } from "@/components/internal-chat/internal-chat-workspace";
import { requireActiveViewer } from "@/lib/auth/session";
import { loadInternalWorkspace } from "@/lib/internal-chat/load-workspace";

export default async function BrokerAssistantPage({ searchParams }: { searchParams: Promise<{ topico?: string; responder?: string }> }) {
  const viewer = await requireActiveViewer();
  if (viewer.membership?.role !== "broker") redirect("/app/chat-pedro");
  const operation = viewer.operations.find((item) => item.is_default) ?? viewer.operations[0];
  const query = await searchParams;
  const workspace = await loadInternalWorkspace({
    orgId: viewer.organization!.id,
    operationId: operation?.id,
    assistantRole: "pedro",
    requestedThreadId: query.topico,
    threadType: "broker_assistant",
  });
  return <InternalChatWorkspace
    assistant="pedro"
    basePath="/app/assistente-corretor"
    description="Peça ajuda sobre o lead atribuído. Pedro consulta o contexto, mas a resposta ao lead continua sendo enviada por você no Inbox."
    emptyText="As consultas aparecem durante sua janela ativa de atendimento e ficam somente para leitura depois dela."
    eyebrow="Apoio durante a call"
    messages={workspace.messages}
    activeThread={workspace.activeThread}
    threads={workspace.threads}
    title="Assistente do corretor"
    replyToMessageId={query.responder}
  />;
}
