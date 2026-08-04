import { redirect } from "next/navigation";

import { InternalChatWorkspace } from "@/components/internal-chat/internal-chat-workspace";
import { requireActiveViewer } from "@/lib/auth/session";
import { loadInternalWorkspace } from "@/lib/internal-chat/load-workspace";

export default async function LionelPage({ searchParams }: { searchParams: Promise<{ topico?: string; responder?: string }> }) {
  const viewer = await requireActiveViewer();
  const canManageAi = viewer.membership?.role === "owner" || viewer.permissions.includes("ai.manage") || viewer.supportAccess === "full";
  if (!canManageAi) redirect("/app");
  const operation = viewer.operations.find((item) => item.is_default) ?? viewer.operations[0];
  if (!operation) redirect("/app");
  const query = await searchParams;
  const workspace = await loadInternalWorkspace({
    orgId: viewer.organization!.id,
    operationId: operation.id,
    assistantRole: "lionel",
    requestedThreadId: query.topico,
  });
  return <InternalChatWorkspace
    assistant="lionel"
    basePath="/app/lionel"
    description="Transforme correções e novas ideias em regras claras, versionadas e sem conflito com o comportamento existente."
    emptyText="Abra o chat geral para iniciar uma curadoria ou aguarde um candidato gerado pelo Pedro."
    eyebrow="Curadoria e governança"
    messages={workspace.messages}
    activeThread={workspace.activeThread}
    threads={workspace.threads}
    title="Lionel"
    replyToMessageId={query.responder}
  />;
}
