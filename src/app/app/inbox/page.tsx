import { Bot, Inbox, Pause, UserRound } from "lucide-react";
import Link from "next/link";

import { NotificationBadge } from "@/components/notification-badge/notification-badge";
import { requireActiveViewer } from "@/lib/auth/session";
import {
  describeInboxNotifications,
  loadInboxNotificationCounts,
} from "@/lib/inbox/notifications";
import { sortInboxConversations } from "@/lib/inbox/sorting";
import { createClient } from "@/lib/supabase/server";
import { formatOperationDateTime } from "@/lib/time/operation-format";
import { ConversationViews } from "./conversation-views";
import styles from "./inbox.module.css";

export default async function InboxPage() {
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const conversationSelect = "id,operation_id,status,ownership,ai_mode,last_inbound_at,last_message_preview,updated_at,contacts!inner(name),opportunities!conversations_opportunity_id_org_id_fkey(id,pipeline_stages!inner(name))";
  const [conversationsResult, notifications] = await Promise.all([
    supabase
      .from("conversations")
      .select(conversationSelect)
      .eq("org_id", viewer.organization!.id)
      .order("updated_at", { ascending: false })
      .limit(100),
    loadInboxNotificationCounts(supabase, viewer.organization!.id),
  ]);
  const { data: conversations, error: conversationsError } = conversationsResult;

  if (conversationsError) {
    console.error("Failed to load Inbox conversations", conversationsError);
    throw new Error("Não foi possível carregar as conversas do Inbox.");
  }

  const recentConversations = conversations ?? [];
  const recentConversationIds = new Set(recentConversations.map((conversation) => conversation.id));
  const attentionConversationIds = [...notifications.byConversation.keys()]
    .filter((conversationId) => !recentConversationIds.has(conversationId));
  let additionalAttentionConversations = recentConversations.slice(0, 0);

  if (attentionConversationIds.length > 0) {
    const additionalConversationsResult = await supabase
      .from("conversations")
      .select(conversationSelect)
      .eq("org_id", viewer.organization!.id)
      .in("id", attentionConversationIds);

    if (additionalConversationsResult.error) {
      console.error("Failed to load Inbox conversations with pending attention", additionalConversationsResult.error);
      throw new Error("Não foi possível carregar as pendências do Inbox.");
    }

    additionalAttentionConversations = additionalConversationsResult.data ?? [];
  }

  const orderedConversations = sortInboxConversations(
    [...recentConversations, ...additionalAttentionConversations],
    notifications.byConversation,
  ).slice(0, 100);
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
            const contact = Array.isArray(conversation.contacts) ? conversation.contacts[0] : conversation.contacts;
            const opportunity = Array.isArray(conversation.opportunities) ? conversation.opportunities[0] : conversation.opportunities;
            const stage = Array.isArray(opportunity?.pipeline_stages) ? opportunity.pipeline_stages[0] : opportunity?.pipeline_stages;
            const notification = notifications.byConversation.get(conversation.id);
            return (
              <Link className={styles.conversationRow} href={`/app/inbox/${conversation.id}`} key={conversation.id} prefetch={false}>
                <span className={styles.avatar}>{contact?.name?.slice(0, 1).toUpperCase() ?? "?"}</span>
                <span className={styles.conversationCopy}><strong>{contact?.name ?? "Contato"}</strong><small>{conversation.last_message_preview || "Conversa criada sem mensagem"}</small></span>
                <span className={styles.contextBadge}>{stage?.name ?? "Sem etapa"}</span>
                <span className={styles.ownerBadge}>{conversation.status === "paused" ? <Pause size={13} /> : conversation.ownership === "ai" ? <Bot size={13} /> : <UserRound size={13} />}{conversation.status === "paused" ? "Pausada" : conversation.ownership === "ai" ? "Pedro" : "Humano"}</span>
                <span className={styles.conversationMeta}>
                  {notification ? (
                    <NotificationBadge
                      count={notification.totalCount}
                      label={describeInboxNotifications(notification)}
                    />
                  ) : null}
                  <time>{formatOperationDateTime(conversation.updated_at, operationTimezones.get(conversation.operation_id))}</time>
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
