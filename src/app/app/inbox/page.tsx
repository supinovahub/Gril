import { Bot, Inbox, Pause, UserRound } from "lucide-react";
import { cookies } from "next/headers";
import { IntentPrefetchLink as Link } from "@/components/navigation/intent-prefetch-link";
import { redirect } from "next/navigation";

import { NotificationBadge } from "@/components/notification-badge/notification-badge";
import type { Database } from "@/lib/database.types";
import {
  describeInboxNotifications,
  type InboxNotificationCount,
} from "@/lib/inbox/notifications";
import { measureServerTask } from "@/lib/observability/server-performance";
import { createClient } from "@/lib/supabase/server";
import { formatOperationDateTime } from "@/lib/time/operation-format";
import { ConversationViews } from "./conversation-views";
import styles from "./inbox.module.css";

type InboxConversationRow = Omit<
  Database["public"]["Views"]["inbox_conversation_list"]["Row"],
  "org_id"
>;

type InboxWorkspacePayload = {
  authenticated: boolean;
  authorized: boolean;
  conversations: InboxConversationRow[];
  memberRole: string | null;
  operations: Array<{ id: string; timezone: string }>;
  organizationId: string | null;
};

export default async function InboxPage() {
  const supabase = await createClient();
  const supportOrgId = (await cookies()).get("gril_support_org")?.value;
  const workspaceResult = await measureServerTask(
    "inbox.workspace",
    () => supabase.rpc("inbox_workspace_bootstrap", {
      p_limit: 100,
      ...(supportOrgId ? { p_org_id: supportOrgId } : {}),
    }),
    { alwaysLog: true },
  );

  if (workspaceResult.error || !workspaceResult.data || Array.isArray(workspaceResult.data)) {
    console.error("Failed to load Inbox workspace", workspaceResult.error);
    throw new Error("Não foi possível carregar as conversas do Inbox.");
  }

  const workspace = workspaceResult.data as unknown as InboxWorkspacePayload;
  if (!workspace.authenticated) redirect("/login");
  if (!workspace.authorized || !workspace.organizationId) redirect("/aguardando-aprovacao");

  const orderedConversations = (workspace.conversations ?? []).filter((conversation) => (
    conversation.id && conversation.operation_id && conversation.updated_at
  ));
  const operationTimezones = new Map(workspace.operations.map((operation) => [operation.id, operation.timezone]));

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div><p className={styles.eyebrow}>Atendimento</p><h1>Conversas</h1><p>Mensagens, sugestões e contexto comercial reunidos no mesmo workspace.</p></div>
        {workspace.memberRole !== "broker" ? <Link className={styles.secondaryButton} href="/app/configuracoes/whatsapp">Configurar números</Link> : null}
      </header>

      <ConversationViews active="conversations" />

      <section className={styles.inboxPanel}>
        <div className={styles.inboxHeader}><span>{orderedConversations.length} conversas</span><span>Pendências primeiro</span></div>
        <div className={styles.conversationList}>
          {orderedConversations.map((conversation) => {
            const notification: InboxNotificationCount | null = (conversation.total_count ?? 0) > 0 ? {
              conversationId: conversation.id!,
              pendingSuggestionCount: conversation.pending_suggestion_count ?? 0,
              totalCount: conversation.total_count ?? 0,
              unreadInboundCount: conversation.unread_inbound_count ?? 0,
            } : null;
            return (
              <Link className={styles.conversationRow} href={`/app/inbox/${conversation.id}`} key={conversation.id} prefetch={false}>
                <span className={styles.avatar}>{conversation.contact_name?.slice(0, 1).toUpperCase() ?? "?"}</span>
                <span className={styles.conversationCopy}><strong>{conversation.contact_name ?? "Contato"}</strong><small>{conversation.last_message_preview || "Conversa criada sem mensagem"}</small></span>
                <span className={styles.contextBadge}>{conversation.stage_name ?? "Sem etapa"}</span>
                <span className={styles.ownerBadge}>{conversation.status === "paused" ? <Pause size={13} /> : conversation.ownership === "ai" ? <Bot size={13} /> : <UserRound size={13} />}{conversation.status === "paused" ? "Pausada" : conversation.ownership === "ai" ? "Pedro" : "Humano"}</span>
                <span className={styles.conversationMeta}>
                  {notification ? (
                    <NotificationBadge
                      count={notification.totalCount}
                      label={describeInboxNotifications(notification)}
                    />
                  ) : null}
                  <time>{formatOperationDateTime(conversation.updated_at!, operationTimezones.get(conversation.operation_id!))}</time>
                </span>
              </Link>
            );
          })}
          {!orderedConversations.length ? <div className={styles.empty}><Inbox size={30} /><strong>Nenhuma conversa visível</strong><span>Quando um webhook válido entrar, o contato e a oportunidade serão criados de forma idempotente.</span></div> : null}
        </div>
      </section>
    </div>
  );
}
