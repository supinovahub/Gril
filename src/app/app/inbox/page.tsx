import { Bot, Inbox, Pause, UserRound } from "lucide-react";
import Link from "next/link";

import { NotificationBadge } from "@/components/notification-badge/notification-badge";
import { requireActiveViewer } from "@/lib/auth/session";
import {
  describeInboxNotifications,
  type InboxNotificationCount,
} from "@/lib/inbox/notifications";
import { measureServerTask } from "@/lib/observability/server-performance";
import { createClient } from "@/lib/supabase/server";
import { formatOperationDateTime } from "@/lib/time/operation-format";
import { ConversationViews } from "./conversation-views";
import styles from "./inbox.module.css";

export default async function InboxPage() {
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { data: conversations, error: conversationsError } = await measureServerTask(
    "inbox.conversation_list",
    () => supabase
      .from("inbox_conversation_list")
      .select("id,operation_id,status,ownership,ai_mode,last_inbound_at,last_message_preview,updated_at,contact_name,opportunity_id,stage_name,unread_inbound_count,pending_suggestion_count,total_count,has_attention")
      .eq("org_id", viewer.organization!.id)
      .order("has_attention", { ascending: false })
      .order("updated_at", { ascending: false })
      .order("id")
      .limit(100),
  );

  if (conversationsError) {
    console.error("Failed to load Inbox conversations", conversationsError);
    throw new Error("Não foi possível carregar as conversas do Inbox.");
  }

  const orderedConversations = (conversations ?? []).filter((conversation) => (
    conversation.id && conversation.operation_id && conversation.updated_at
  ));
  const operationTimezones = new Map(viewer.operations.map((operation) => [operation.id, operation.timezone]));

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div><p className={styles.eyebrow}>Atendimento</p><h1>Conversas</h1><p>Mensagens, sugestões e contexto comercial reunidos no mesmo workspace.</p></div>
        {viewer.membership?.role !== "broker" ? <Link className={styles.secondaryButton} href="/app/configuracoes/whatsapp">Configurar números</Link> : null}
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
