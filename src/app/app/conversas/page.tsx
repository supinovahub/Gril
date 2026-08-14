import { Archive, ArrowRight, Bot, Inbox, Pause, Search, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { NotificationBadge } from "@/components/notification-badge/notification-badge";
import { requireActiveViewer } from "@/lib/auth/session";
import {
  describeInboxNotifications,
  loadInboxNotificationCounts,
} from "@/lib/inbox/notifications";
import { sortInboxConversations } from "@/lib/inbox/sorting";
import { createClient } from "@/lib/supabase/server";
import { formatOperationDateTime } from "@/lib/time/operation-format";
import styles from "./conversas.module.css";

type ConversationView = {
  id: string;
  operation_id: string;
  status: string;
  ownership: string;
  ai_mode: string;
  last_message_preview: string | null;
  updated_at: string;
  contacts: { name: string | null } | { name: string | null }[] | null;
  opportunities: {
    id: string;
    status: string;
    pipeline_stages: { name: string } | { name: string }[] | null;
  } | {
    id: string;
    status: string;
    pipeline_stages: { name: string } | { name: string }[] | null;
  }[] | null;
};

const views = [
  { id: "all", label: "Todos", description: "Conversas ativas" },
  { id: "unanswered", label: "Não respondidos", description: "Mensagens e sugestões" },
  { id: "working", label: "Em andamento", description: "Atendimento em curso" },
  { id: "scheduled", label: "Agendados", description: "Próximos atendimentos" },
  { id: "converted", label: "Convertidos", description: "Oportunidades ganhas" },
  { id: "archived", label: "Arquivados", description: "Histórico encerrado" },
] as const;

type ViewId = (typeof views)[number]["id"];

function getView(value: string | undefined): ViewId {
  return views.some((item) => item.id === value) ? value as ViewId : "all";
}
function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isArchived(conversation: ConversationView) {
  return ["closed", "archived", "cancelled", "completed"].includes(conversation.status);
}

function filterConversation(
  conversation: ConversationView,
  view: ViewId,
  notifications: Awaited<ReturnType<typeof loadInboxNotificationCounts>>["byConversation"],
) {
  const opportunity = one(conversation.opportunities);
  const notification = notifications.get(conversation.id);

  if (view === "archived") return isArchived(conversation);
  if (isArchived(conversation)) return false;
  if (view === "unanswered") return Boolean(notification?.unreadInboundCount);
  if (view === "working") return ["active", "waiting_lead", "human_owned", "returned_to_ai", "sleeping", "paused"].includes(conversation.status);
  if (view === "scheduled") return opportunity?.status === "call_scheduled";
  if (view === "converted") return opportunity?.status === "won";
  return true;
}

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; cursor?: string }>;
}) {
  const viewer = await requireActiveViewer();
  const params = await searchParams;
  const view = getView(params.view);
  const query = params.q?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const cursor = params.cursor ? decodeURIComponent(params.cursor) : "";
  const supabase = await createClient();
  const conversationSelect = "id,operation_id,status,ownership,ai_mode,last_message_preview,updated_at,contacts!inner(name),opportunities!conversations_opportunity_id_org_id_fkey(id,status,pipeline_stages!inner(name))";
  const conversationsQuery = supabase
      .from("conversations")
      .select(conversationSelect)
      .eq("org_id", viewer.organization!.id)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(101);
  if (cursor) conversationsQuery.lt("updated_at", cursor);
  const [conversationsResult, notifications] = await Promise.all([
    conversationsQuery,
    loadInboxNotificationCounts(supabase, viewer.organization!.id),
  ]);

  if (conversationsResult.error) {
    console.error("Failed to load conversations", conversationsResult.error);
    throw new Error("Não foi possível carregar as conversas.");
  }

  const loadedConversations = (conversationsResult.data ?? []) as unknown as ConversationView[];
  const hasMore = loadedConversations.length > 100;
  const recentConversations = loadedConversations.slice(0, 100);
  const recentConversationIds = new Set(recentConversations.map((conversation) => conversation.id));
  const attentionConversationIds = [...notifications.byConversation.keys()].filter((id) => !recentConversationIds.has(id));
  let additionalAttentionConversations: ConversationView[] = [];

  if (attentionConversationIds.length > 0) {
    const additionalResult = await supabase
      .from("conversations")
      .select(conversationSelect)
      .eq("org_id", viewer.organization!.id)
      .in("id", attentionConversationIds);
    if (additionalResult.error) {
      console.error("Failed to load conversations with attention", additionalResult.error);
      throw new Error("Não foi possível carregar as pendências.");
    }
    additionalAttentionConversations = (additionalResult.data ?? []) as unknown as ConversationView[];
  }

  const allConversations = [...recentConversations, ...additionalAttentionConversations];
  const filteredConversations = allConversations
    .filter((conversation) => filterConversation(conversation, view, notifications.byConversation))
    .filter((conversation) => {
      if (!query) return true;
      const contact = one(conversation.contacts);
      return `${contact?.name ?? ""} ${conversation.last_message_preview ?? ""}`.toLocaleLowerCase("pt-BR").includes(query);
    });
  const orderedConversations = sortInboxConversations(filteredConversations, notifications.byConversation).slice(0, 100);
  const operationTimezones = new Map(viewer.operations.map((operation) => [operation.id, operation.timezone]));
  const selectedView = views.find((item) => item.id === view)!;
  const buildHref = (nextView: ViewId, nextCursor?: string) => {
    const search = new URLSearchParams({ view: nextView });
    if (params.q) search.set("q", params.q);
    if (nextCursor) search.set("cursor", encodeURIComponent(nextCursor));
    return `/app/conversas?${search.toString()}`;
  };
  const lastConversation = recentConversations.at(-1);
  const nextCursor = hasMore ? lastConversation?.updated_at : undefined;

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Atendimento"
        title="Conversas"
        description="Triagem de leads e acompanhamento de Pedro IA em uma única mesa de trabalho."
      >
        <ButtonLink href="/app/kanban" variant="secondary">Ver Kanban</ButtonLink>
        {viewer.membership?.role !== "broker" ? <ButtonLink href="/app/configuracoes/whatsapp" variant="secondary">Configurar números</ButtonLink> : null}
      </PageHeader>

      <section className={styles.queueSummary} aria-label="Resumo das conversas">
        <Link className={styles.queuePrimary} href={buildHref("unanswered")}><span>Atenção agora</span><strong>{notifications.conversationsWithNotifications}</strong></Link>
        <Link href={buildHref("working")}><span>Em atendimento</span><strong>{allConversations.filter((conversation) => filterConversation(conversation, "working", notifications.byConversation)).length}</strong></Link>
        <Link href={buildHref("scheduled")}><span>Agendados</span><strong>{allConversations.filter((conversation) => filterConversation(conversation, "scheduled", notifications.byConversation)).length}</strong></Link>
        <Link href={buildHref("converted")}><span>Convertidos</span><strong>{allConversations.filter((conversation) => filterConversation(conversation, "converted", notifications.byConversation)).length}</strong></Link>
      </section>

      <section className={styles.workspace} aria-label="Lista de conversas">
        <div className={styles.toolbar}>
          <Tabs className={styles.compactTabs} activeId={view} ariaLabel="Views de conversas" items={views.map((item) => ({ ...item, href: buildHref(item.id) }))} />
          <form className={styles.searchForm} action="/app/conversas">
            <input name="view" type="hidden" value={view} />
            <Search aria-hidden="true" size={16} />
            <input aria-label="Buscar conversa" defaultValue={params.q} name="q" placeholder="Buscar pessoa ou mensagem" />
          </form>
        </div>

        <div className={styles.listHeader}>
          <div><strong>{selectedView.label}</strong><span>{selectedView.description}</span></div>
          <span>{orderedConversations.length} visíveis</span>
        </div>

        <div className={styles.columnHeader} aria-hidden="true">
          <span />
          <span>Lead e última mensagem</span>
          <span>Status</span>
          <span>Responsável</span>
          <span>Última</span>
        </div>

        <div className={styles.conversationList}>
          {orderedConversations.map((conversation) => {
            const contact = one(conversation.contacts);
            const opportunity = one(conversation.opportunities);
            const stage = one(opportunity?.pipeline_stages);
            const notification = notifications.byConversation.get(conversation.id);
            const ownerLabel = conversation.status === "paused" ? "Pausada" : conversation.ownership === "ai" ? "Pedro" : "Humano";
            const ownerTone = conversation.status === "paused" ? "warning" : conversation.ownership === "ai" ? "accent" : "positive";
            const signal = notification?.pendingSuggestionCount
              ? "suggestion"
              : notification?.unreadInboundCount
                ? "unread"
                : "none";
            const statusLabel = isArchived(conversation)
              ? "Arquivada"
              : conversation.status === "paused"
                ? "Pausada"
                : opportunity?.status === "call_scheduled"
                  ? "Agendado"
                  : notification
                    ? "Aguardando"
                    : conversation.status === "human_owned"
                      ? "Em atendimento"
                      : "Em aberto";
            const statusTone = isArchived(conversation)
              ? "neutral"
              : conversation.status === "paused"
                ? "warning"
                : opportunity?.status === "call_scheduled"
                  ? "positive"
                  : notification
                    ? "accent"
                    : "neutral";
            return (
              <Link className={styles.conversationRow} href={`/app/inbox/${conversation.id}`} key={conversation.id}>
                <span className={`${styles.signal} ${styles[`signal${signal[0].toUpperCase()}${signal.slice(1)}`]}`} aria-label={signal === "suggestion" ? "Sugestão de Pedro pendente" : signal === "unread" ? "Mensagem nova" : undefined}>
                  {signal === "suggestion" ? <Sparkles aria-hidden="true" size={13} /> : signal === "unread" ? <span aria-hidden="true" /> : null}
                </span>
                <span className={styles.conversationCopy}>
                  <span className={styles.personLine}>
                    <strong>{contact?.name ?? "Contato"}</strong>
                    <StatusBadge tone={stage ? "positive" : "neutral"}>{stage?.name ?? "Sem etapa"}</StatusBadge>
                  </span>
                  <small>{conversation.last_message_preview || "Conversa criada sem mensagem"}</small>
                </span>
                <span className={styles.rowStatus}>
                  <StatusBadge tone={statusTone}>{conversation.status === "closed" ? <Archive aria-hidden="true" size={12} /> : null}{statusLabel}</StatusBadge>
                </span>
                <span className={styles.rowOwner}>
                  <StatusBadge tone={ownerTone}>{conversation.ownership === "ai" ? <Bot aria-hidden="true" size={12} /> : conversation.status === "paused" ? <Pause aria-hidden="true" size={12} /> : <UserRound aria-hidden="true" size={12} />}{ownerLabel}</StatusBadge>
                </span>
                <span className={styles.conversationMeta}>
                  {notification ? <NotificationBadge count={notification.totalCount} label={describeInboxNotifications(notification)} /> : null}
                  <time>{formatOperationDateTime(conversation.updated_at, operationTimezones.get(conversation.operation_id))}</time>
                </span>
              </Link>
            );
          })}
          {!orderedConversations.length ? <EmptyState action={view !== "all" ? <ButtonLink href={buildHref("all")} size="sm" variant="secondary">Ver todas as conversas</ButtonLink> : null} description={query ? "Tente buscar por outro nome ou mensagem." : "Quando uma conversa entrar, ela aparecerá aqui com o próximo passo."} icon={<Inbox size={22} />} title="Nenhuma conversa nesta view" /> : null}
        </div>
        {hasMore ? <footer className={styles.pagination}><span>Mostrando até 100 conversas nesta view.</span><Link href={buildHref(view, nextCursor)}>Carregar mais <ArrowRight size={14} /></Link></footer> : null}
      </section>
    </div>
  );
}
