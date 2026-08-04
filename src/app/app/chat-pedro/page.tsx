import { redirect } from "next/navigation";

import { InternalChatWorkspace } from "@/components/internal-chat/internal-chat-workspace";
import { requireActiveViewer } from "@/lib/auth/session";
import { loadInternalWorkspace } from "@/lib/internal-chat/load-workspace";

export default async function PedroChatPage({ searchParams }: { searchParams: Promise<{ topico?: string; responder?: string }> }) {
  const viewer = await requireActiveViewer();
  if (viewer.membership?.role === "broker" || (!viewer.membership && viewer.supportAccess !== "full")) redirect("/app");
  const operation = viewer.operations.find((item) => item.is_default) ?? viewer.operations[0];
  if (!operation) redirect("/app");
  const query = await searchParams;
  const workspace = await loadInternalWorkspace({
    orgId: viewer.organization!.id,
    operationId: operation.id,
    assistantRole: "pedro",
    requestedThreadId: query.topico,
  });
  return <InternalChatWorkspace
    assistant="pedro"
    basePath="/app/chat-pedro"
    description="Resolva impasses de leads, campanhas e agenda com o contexto operacional reunido em um só lugar."
    emptyText="Quando Pedro escalar uma decisão, o tópico aparecerá aqui."
    eyebrow="Copiloto operacional"
    messages={workspace.messages}
    activeThread={workspace.activeThread}
    threads={workspace.threads}
    title="Chat geral com Pedro"
    replyToMessageId={query.responder}
  />;
}
