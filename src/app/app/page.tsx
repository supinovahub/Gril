import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CalendarDays,
  ExternalLink,
  MessageSquareText,
} from "lucide-react";
import { IntentPrefetchLink as Link } from "@/components/navigation/intent-prefetch-link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { canManageTeam, requireActiveViewer } from "@/lib/auth/session";
import type { Database } from "@/lib/database.types";
import { measureServerTask } from "@/lib/observability/server-performance";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_OPERATION_TIMEZONE, formatOperationDateTime } from "@/lib/time/operation-format";
import { zonedLocalDateTimeToIso } from "@/lib/time/zoned-local";
import { HomologationCleanupPanel } from "./homologation-cleanup-panel";
import styles from "./dashboard.module.css";

type DashboardPeriod = "today" | "7d" | "30d";
type DashboardSearchParams = {
  erro?: string;
  limpeza?: string;
  period?: string;
};

type PeriodRange = {
  end: string;
  label: string;
  start: string;
};

type MetricSnapshot = {
  appointments: number | null;
  conversionRate: number | null;
  inboundConversations: number | null;
  newLeads: number | null;
  responseRate: number | null;
  sales: number | null;
};

type KanbanCard = {
  assignedMembershipId: string | null;
  id: string;
  name: string;
  stageEnteredAt: string;
};

type KanbanColumn = {
  cards: KanbanCard[];
  code: string;
  count: number | null;
  id: string;
  name: string;
};

type AttentionItem = {
  action: string;
  href: string;
  id: string;
  name: string;
  reason: string;
  waitingSince: string;
};

type AgendaItem = {
  format: string;
  href: string;
  id: string;
  name: string;
  startsAt: string;
};

type TeamDirectory = {
  namesByMembership: Record<string, string>;
};

type DashboardWorkspacePayload = {
  authenticated: boolean;
  authorized: boolean;
  canManageTeam: boolean;
  agendaItems: Array<{
    format: string;
    id: string;
    name: string;
    opportunityId: string;
    startsAt: string;
  }>;
  attentionItems: Array<{
    id: string;
    name: string;
    pendingSuggestionCount: number;
    unreadInboundCount: number;
    waitingSince: string;
  }>;
  kanban: KanbanColumn[];
  metrics: {
    appointments: number;
    inboundConversations: number;
    newLeads: number;
    respondedConversations: number;
    sales: number;
  };
  organizationId: string | null;
  team: TeamDirectory;
  timezone: string;
};

type DashboardWorkspace = {
  agendaItems: AgendaItem[];
  attentionItems: AttentionItem[];
  authenticated: boolean;
  authorized: boolean;
  canManageTeam: boolean;
  kanban: { columns: KanbanColumn[]; failed: boolean };
  metrics: MetricSnapshot;
  organizationId: string | null;
  teamDirectory: TeamDirectory;
  timeZone: string;
};

const periodOptions: Array<{ key: DashboardPeriod; label: string }> = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
];

const periodDays: Record<DashboardPeriod, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
};

function resolvePeriod(value: string | undefined): DashboardPeriod {
  return value === "today" || value === "30d" ? value : "7d";
}

function localDateAt(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftLocalDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildPeriodRange(period: DashboardPeriod, timeZone: string, now: Date): PeriodRange {
  const days = periodDays[period];
  const localToday = localDateAt(now, timeZone);
  const startDate = shiftLocalDate(localToday, -(days - 1));
  return {
    end: now.toISOString(),
    label: periodOptions.find((option) => option.key === period)?.label ?? "7 dias",
    start: zonedLocalDateTimeToIso(`${startDate}T00:00`, timeZone),
  };
}

function firstRelated<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatPercentage(value: number | null) {
  if (value === null) return "N/D";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 0 })}%`;
}

function formatWaitingTime(value: string, now: Date) {
  const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 60_000));
  if (elapsedMinutes < 60) return `${Math.max(1, elapsedMinutes)} min`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} h`;
  return `${Math.floor(elapsedHours / 24)} d`;
}

function formatCallType(value: string) {
  if (value === "video") return "Videochamada";
  if (value === "phone") return "Ligação";
  return "Call";
}

async function loadMetrics(
  supabase: SupabaseClient<Database>,
  orgId: string,
  range: PeriodRange,
): Promise<MetricSnapshot> {
  const metricsResult = await supabase.rpc("dashboard_metrics", {
    p_org_id: orgId,
    p_range_end: range.end,
    p_range_start: range.start,
  });
  const metric = metricsResult.data?.[0];
  if (!metricsResult.error && metric) {
    const newLeads = metric.new_leads ?? 0;
    const appointments = metric.appointments ?? 0;
    const sales = metric.sales ?? 0;
    const inboundConversations = metric.inbound_conversations ?? 0;
    const respondedConversations = metric.responded_conversations ?? 0;
    return {
      appointments,
      conversionRate: newLeads > 0 ? (sales / newLeads) * 100 : null,
      inboundConversations,
      newLeads,
      responseRate: inboundConversations > 0
        ? (respondedConversations / inboundConversations) * 100
        : null,
      sales,
    };
  }

  console.warn("Falling back to legacy Dashboard metric queries", metricsResult.error?.code);
  const [leadsResult, appointmentsResult, salesResult, conversationsResult] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .gte("created_at", range.start)
      .lte("created_at", range.end),
    supabase
      .from("calls")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .gte("created_at", range.start)
      .lte("created_at", range.end),
    supabase
      .from("sales")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .neq("status", "cancelled")
      .gte("confirmed_at", range.start)
      .lte("confirmed_at", range.end),
    supabase
      .from("conversations")
      .select("last_inbound_at,last_outbound_at", { count: "exact" })
      .eq("org_id", orgId)
      .gte("last_inbound_at", range.start)
      .lte("last_inbound_at", range.end)
      .limit(1000),
  ]);

  if (leadsResult.error) console.error("Failed to load Dashboard lead metric", leadsResult.error);
  if (appointmentsResult.error) console.error("Failed to load Dashboard appointment metric", appointmentsResult.error);
  if (salesResult.error) console.error("Failed to load Dashboard sales metric", salesResult.error);
  if (conversationsResult.error) console.error("Failed to load Dashboard response metric", conversationsResult.error);

  const newLeads = leadsResult.error ? null : (leadsResult.count ?? 0);
  const appointments = appointmentsResult.error ? null : (appointmentsResult.count ?? 0);
  const sales = salesResult.error ? null : (salesResult.count ?? 0);
  const conversationRows = conversationsResult.data ?? [];
  const completeConversationWindow = !conversationsResult.error
    && (conversationsResult.count ?? conversationRows.length) === conversationRows.length;
  const inboundConversations = completeConversationWindow ? conversationRows.length : null;
  const respondedConversations = completeConversationWindow
    ? conversationRows.filter((conversation) => {
        if (!conversation.last_inbound_at || !conversation.last_outbound_at) return false;
        return Date.parse(conversation.last_outbound_at) >= Date.parse(conversation.last_inbound_at);
      }).length
    : null;
  const responseRate = inboundConversations && respondedConversations !== null
    ? (respondedConversations / inboundConversations) * 100
    : null;
  const conversionRate = newLeads && sales !== null
    ? (sales / newLeads) * 100
    : null;

  return {
    appointments,
    conversionRate,
    inboundConversations,
    newLeads,
    responseRate,
    sales,
  };
}

async function loadKanbanSnapshot(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<{ columns: KanbanColumn[]; failed: boolean }> {
  const snapshotResult = await supabase
    .from("dashboard_kanban_snapshot")
    .select("stage_id,stage_code,stage_name,stage_position,card_count,card_id,assigned_membership_id,stage_entered_at,contact_name")
    .eq("org_id", orgId)
    .order("stage_position");

  if (!snapshotResult.error) {
    return {
      columns: (snapshotResult.data ?? []).flatMap((stage) => stage.stage_id && stage.stage_code && stage.stage_name ? [{
        cards: stage.card_id ? [{
          assignedMembershipId: stage.assigned_membership_id,
          id: stage.card_id,
          name: stage.contact_name ?? "Contato",
          stageEnteredAt: stage.stage_entered_at!,
        }] : [],
        code: stage.stage_code,
        count: stage.card_count ?? 0,
        id: stage.stage_id,
        name: stage.stage_name,
      }] : []),
      failed: false,
    };
  }

  console.warn("Falling back to legacy Dashboard Kanban queries", snapshotResult.error.code);
  const stagesResult = await supabase
    .from("pipeline_stages")
    .select("id,code,name,position")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("position");

  if (stagesResult.error) {
    console.error("Failed to load Dashboard pipeline stages", stagesResult.error);
    return { columns: [], failed: true };
  }

  const columns = await Promise.all((stagesResult.data ?? []).map(async (stage) => {
    const cardsResult = await supabase
      .from("opportunities")
      .select(
        "id,assigned_membership_id,stage_entered_at,contacts!inner(name,status)",
        { count: "exact" },
      )
      .eq("org_id", orgId)
      .eq("pipeline_stage_id", stage.id)
      .eq("contacts.status", "active")
      .order("last_activity_at", { ascending: false })
      .limit(1);

    if (cardsResult.error) {
      console.error(`Failed to load Dashboard stage ${stage.code}`, cardsResult.error);
    }

    const cards: KanbanCard[] = (cardsResult.data ?? []).map((card) => {
      const contact = firstRelated(card.contacts);
      return {
        assignedMembershipId: card.assigned_membership_id,
        id: card.id,
        name: contact?.name ?? "Contato",
        stageEnteredAt: card.stage_entered_at,
      };
    });

    return {
      cards,
      code: stage.code,
      count: cardsResult.error ? null : (cardsResult.count ?? 0),
      id: stage.id,
      name: stage.name,
    };
  }));

  return { columns, failed: false };
}

async function loadAttentionItems(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<AttentionItem[]> {
  const attentionResult = await supabase
    .from("inbox_conversation_list")
    .select("id,contact_name,last_inbound_at,updated_at,pending_suggestion_count,total_count,unread_inbound_count")
    .eq("org_id", orgId)
    .gt("total_count", 0)
    .order("pending_suggestion_count", { ascending: false })
    .order("unread_inbound_count", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(3);

  if (!attentionResult.error) {
    return (attentionResult.data ?? []).flatMap((conversation) => {
      if (!conversation.id || !conversation.updated_at) return [];
      const pendingSuggestions = conversation.pending_suggestion_count ?? 0;
      const unreadMessages = conversation.unread_inbound_count ?? 0;
      return [{
        action: pendingSuggestions > 0 ? "Revisar" : "Responder",
        href: `/app/inbox/${conversation.id}`,
        id: conversation.id,
        name: conversation.contact_name ?? "Contato",
        reason: pendingSuggestions > 0
          ? `${pendingSuggestions} ${pendingSuggestions === 1 ? "sugestão aguarda" : "sugestões aguardam"} revisão`
          : `${unreadMessages} ${unreadMessages === 1 ? "mensagem nova" : "mensagens novas"}`,
        waitingSince: conversation.last_inbound_at ?? conversation.updated_at,
      }];
    });
  }

  console.warn("Falling back to legacy Dashboard attention queries", attentionResult.error.code);
  const countsResult = await supabase
    .from("inbox_notification_counts")
    .select("conversation_id,pending_suggestion_count,total_count,unread_inbound_count")
    .eq("org_id", orgId)
    .gt("total_count", 0)
    .order("pending_suggestion_count", { ascending: false })
    .order("unread_inbound_count", { ascending: false })
    .limit(12);

  if (countsResult.error) {
    console.error("Failed to load Dashboard attention counts", countsResult.error);
    return [];
  }

  const counts = (countsResult.data ?? []).filter((row) => Boolean(row.conversation_id));
  const conversationIds = counts.flatMap((row) => row.conversation_id ? [row.conversation_id] : []);
  if (!conversationIds.length) return [];

  const conversationsResult = await supabase
    .from("conversations")
    .select("id,last_inbound_at,updated_at,contacts!inner(name)")
    .eq("org_id", orgId)
    .in("id", conversationIds);

  if (conversationsResult.error) {
    console.error("Failed to load Dashboard attention conversations", conversationsResult.error);
    return [];
  }

  const countsByConversation = new Map(counts.map((row) => [row.conversation_id, row]));
  return (conversationsResult.data ?? [])
    .sort((left, right) => {
      const leftCount = countsByConversation.get(left.id);
      const rightCount = countsByConversation.get(right.id);
      const pendingDifference = (rightCount?.pending_suggestion_count ?? 0)
        - (leftCount?.pending_suggestion_count ?? 0);
      if (pendingDifference !== 0) return pendingDifference;
      const totalDifference = (rightCount?.total_count ?? 0) - (leftCount?.total_count ?? 0);
      if (totalDifference !== 0) return totalDifference;
      return Date.parse(right.updated_at) - Date.parse(left.updated_at);
    })
    .slice(0, 3)
    .map((conversation) => {
      const count = countsByConversation.get(conversation.id);
      const pendingSuggestions = count?.pending_suggestion_count ?? 0;
      const unreadMessages = count?.unread_inbound_count ?? 0;
      const contact = firstRelated(conversation.contacts);
      const reason = pendingSuggestions > 0
        ? `${pendingSuggestions} ${pendingSuggestions === 1 ? "sugestão aguarda" : "sugestões aguardam"} revisão`
        : `${unreadMessages} ${unreadMessages === 1 ? "mensagem nova" : "mensagens novas"}`;
      return {
        action: pendingSuggestions > 0 ? "Revisar" : "Responder",
        href: `/app/inbox/${conversation.id}`,
        id: conversation.id,
        name: contact?.name ?? "Contato",
        reason,
        waitingSince: conversation.last_inbound_at ?? conversation.updated_at,
      };
    });
}

async function loadAgendaItems(
  supabase: SupabaseClient<Database>,
  orgId: string,
  now: Date,
): Promise<AgendaItem[]> {
  const callsResult = await supabase
    .from("calls")
    .select("id,format,opportunity_id,starts_at,opportunities(title,contacts(name))")
    .eq("org_id", orgId)
    .in("status", [
      "awaiting_manager",
      "awaiting_distribution",
      "distributing",
      "unassigned_alerted",
      "assigned",
      "rescheduled",
    ])
    .gte("starts_at", now.toISOString())
    .order("starts_at")
    .limit(3);

  if (callsResult.error) {
    console.error("Failed to load Dashboard agenda", callsResult.error);
    return [];
  }

  return (callsResult.data ?? []).map((call) => {
    const opportunity = firstRelated(call.opportunities);
    const contact = firstRelated(opportunity?.contacts);
    return {
      format: call.format,
      href: `/app/leads/${call.opportunity_id}`,
      id: call.id,
      name: contact?.name ?? opportunity?.title ?? "Lead",
      startsAt: call.starts_at,
    };
  });
}

async function loadTeamDirectory(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<TeamDirectory> {
  const membershipsResult = await supabase
    .from("memberships")
    .select("id,user_id")
    .eq("org_id", orgId)
    .eq("status", "active");

  if (membershipsResult.error) console.error("Failed to load Dashboard team", membershipsResult.error);

  const memberships = membershipsResult.data ?? [];
  const profilesResult = memberships.length
    ? await supabase
        .from("profiles")
        .select("user_id,full_name")
        .in("user_id", memberships.map((membership) => membership.user_id))
    : { data: [], error: null };

  if (profilesResult.error) console.error("Failed to load Dashboard team names", profilesResult.error);

  const namesByUser = new Map((profilesResult.data ?? []).map((profile) => [profile.user_id, profile.full_name]));
  return {
    namesByMembership: Object.fromEntries(memberships.map((membership) => [
      membership.id,
      namesByUser.get(membership.user_id) ?? "Equipe",
    ])),
  };
}

async function loadDashboardWorkspace(
  supabase: SupabaseClient<Database>,
  requestedOrgId: string | undefined,
  period: DashboardPeriod,
  now: Date,
): Promise<DashboardWorkspace> {
  const workspaceResult = await supabase.rpc("dashboard_workspace_bootstrap", {
    p_now: now.toISOString(),
    p_period: period,
    ...(requestedOrgId ? { p_org_id: requestedOrgId } : {}),
  });

  if (!workspaceResult.error && workspaceResult.data && !Array.isArray(workspaceResult.data)) {
    const payload = workspaceResult.data as unknown as DashboardWorkspacePayload;
    const newLeads = payload.metrics.newLeads ?? 0;
    const appointments = payload.metrics.appointments ?? 0;
    const sales = payload.metrics.sales ?? 0;
    const inboundConversations = payload.metrics.inboundConversations ?? 0;
    const respondedConversations = payload.metrics.respondedConversations ?? 0;
    return {
      agendaItems: (payload.agendaItems ?? []).map((item) => ({
        format: item.format,
        href: `/app/leads/${item.opportunityId}`,
        id: item.id,
        name: item.name,
        startsAt: item.startsAt,
      })),
      authenticated: payload.authenticated,
      authorized: payload.authorized,
      canManageTeam: payload.canManageTeam,
      attentionItems: (payload.attentionItems ?? []).map((item) => ({
        action: item.pendingSuggestionCount > 0 ? "Revisar" : "Responder",
        href: `/app/inbox/${item.id}`,
        id: item.id,
        name: item.name,
        reason: item.pendingSuggestionCount > 0
          ? `${item.pendingSuggestionCount} ${item.pendingSuggestionCount === 1 ? "sugestão aguarda" : "sugestões aguardam"} revisão`
          : `${item.unreadInboundCount} ${item.unreadInboundCount === 1 ? "mensagem nova" : "mensagens novas"}`,
        waitingSince: item.waitingSince,
      })),
      kanban: {
        columns: payload.kanban ?? [],
        failed: false,
      },
      metrics: {
        appointments,
        conversionRate: newLeads > 0 ? (sales / newLeads) * 100 : null,
        inboundConversations,
        newLeads,
        responseRate: inboundConversations > 0
          ? (respondedConversations / inboundConversations) * 100
          : null,
        sales,
      },
      organizationId: payload.organizationId,
      teamDirectory: payload.team ?? { namesByMembership: {} },
      timeZone: payload.timezone ?? DEFAULT_OPERATION_TIMEZONE,
    };
  }

  console.warn("Falling back to legacy Dashboard queries", workspaceResult.error?.code);
  const viewer = await requireActiveViewer();
  const orgId = viewer.organization!.id;
  const operation = viewer.operations.find((item) => item.is_default) ?? viewer.operations[0];
  const timeZone = operation?.timezone ?? DEFAULT_OPERATION_TIMEZONE;
  const range = buildPeriodRange(period, timeZone, now);
  const [metrics, kanban, attentionItems, agendaItems, teamDirectory] = await Promise.all([
    loadMetrics(supabase, orgId, range),
    loadKanbanSnapshot(supabase, orgId),
    loadAttentionItems(supabase, orgId),
    loadAgendaItems(supabase, orgId, now),
    loadTeamDirectory(supabase, orgId),
  ]);
  return {
    agendaItems,
    attentionItems,
    authenticated: true,
    authorized: true,
    canManageTeam: canManageTeam(viewer),
    kanban,
    metrics,
    organizationId: orgId,
    teamDirectory,
    timeZone,
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<DashboardSearchParams>;
}) {
  const supabase = await createClient();
  const feedback = searchParams ? await searchParams : {};
  const period = resolvePeriod(feedback.period);
  const now = new Date();
  const supportOrgId = (await cookies()).get("gril_support_org")?.value;
  const workspace = await measureServerTask(
    "dashboard.workspace",
    () => loadDashboardWorkspace(supabase, supportOrgId, period, now),
    { alwaysLog: true },
  );
  if (!workspace.authenticated) redirect("/login");
  if (!workspace.authorized || !workspace.organizationId) redirect("/aguardando-aprovacao");

  const {
    agendaItems,
    attentionItems,
    canManageTeam: managesTeam,
    kanban,
    metrics,
    teamDirectory,
    timeZone,
  } = workspace;
  const range = buildPeriodRange(period, timeZone, now);
  const updatedAt = formatOperationDateTime(now, timeZone, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const pipelineTotal = kanban.failed || kanban.columns.some((column) => column.count === null)
    ? null
    : kanban.columns.reduce((total, column) => total + (column.count ?? 0), 0);
  const activeStageCount = kanban.columns.filter((column) => (column.count ?? 0) > 0).length;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeading}>
          <h1>Visão geral</h1>
          <p>Resultado do período e estoque atual do pipeline.</p>
        </div>
        <div className={styles.headerTools}>
          <nav aria-label="Período das métricas" className={styles.periodSwitch}>
            {periodOptions.map((option) => (
              <Link
                aria-current={period === option.key ? "page" : undefined}
                className={period === option.key ? styles.periodActive : undefined}
                href={option.key === "7d" ? "/app" : `/app?period=${option.key}`}
                key={option.key}
                prefetch={false}
              >
                {option.label}
              </Link>
            ))}
          </nav>
          <span className={styles.updatedAt}>Atualizado às {updatedAt}</span>
        </div>
      </header>

      {feedback.erro ? <p className={styles.feedbackError}>{feedback.erro}</p> : null}
      {feedback.limpeza === "concluida" ? (
        <p className={styles.feedbackSuccess}>Contexto HML- limpo. Auditoria e configurações foram preservadas.</p>
      ) : null}
      {feedback.limpeza === "concluida-com-arquivos-pendentes" ? (
        <p className={styles.feedbackWarning}>O banco foi limpo, mas alguns arquivos ainda precisam de revisão.</p>
      ) : null}
      {feedback.limpeza === "nenhum-contexto-elegivel" ? (
        <p className={styles.feedbackSuccess}>Nenhum contexto HML- elegível foi encontrado.</p>
      ) : null}

      <section aria-label={`Métricas de ${range.label.toLocaleLowerCase("pt-BR")}`} className={styles.metrics}>
        <article className={styles.metric} title="Oportunidades criadas no período selecionado.">
          <span>Leads</span>
          <strong>{metrics.newLeads ?? "N/D"}</strong>
          <small>Entradas em {range.label.toLocaleLowerCase("pt-BR")}</small>
        </article>
        <article className={styles.metric} title="Conversas cuja mensagem mais recente do lead já recebeu resposta.">
          <span>Taxa de resposta</span>
          <strong>{formatPercentage(metrics.responseRate)}</strong>
          <small>{metrics.inboundConversations === null ? "Dados indisponíveis" : `${metrics.inboundConversations} conversas com entrada`}</small>
        </article>
        <article className={styles.metric} title="Calls criadas no período selecionado.">
          <span>Agendamentos</span>
          <strong>{metrics.appointments ?? "N/D"}</strong>
          <small>Criados em {range.label.toLocaleLowerCase("pt-BR")}</small>
        </article>
        <article className={styles.metric} title="Vendas confirmadas e conversão sobre os leads criados no mesmo período.">
          <span>Vendas</span>
          <strong>{metrics.sales ?? "N/D"}</strong>
          <small>Conversão de {formatPercentage(metrics.conversionRate)}</small>
        </article>
      </section>

      <section className={styles.kanbanPanel} aria-labelledby="kanban-snapshot-title">
        <header className={styles.sectionHeader}>
          <div className={styles.sectionHeading}>
            <h2 id="kanban-snapshot-title">Kanban comercial</h2>
            <p>
              Estoque atual · independente do período
              {pipelineTotal === null
                ? ""
                : ` · ${pipelineTotal} ${pipelineTotal === 1 ? "oportunidade" : "oportunidades"} em ${activeStageCount} ${activeStageCount === 1 ? "etapa" : "etapas"}`}
            </p>
          </div>
          <Link href="/app/kanban">
            Abrir Kanban completo <ExternalLink aria-hidden="true" size={13} />
          </Link>
        </header>
        {kanban.failed ? (
          <p className={styles.sectionError}>Não foi possível carregar o Kanban agora.</p>
        ) : kanban.columns.length ? (
          <div className={styles.kanbanGrid}>
            {kanban.columns.map((column) => {
              const hiddenCount = column.count === null ? null : Math.max(0, column.count - column.cards.length);
              return (
                <section className={styles.kanbanColumn} key={column.id}>
                  <header className={column.code === "won" ? styles.wonStage : column.code === "lost" ? styles.lostStage : undefined}>
                    <span>{column.name}</span>
                    <strong>{column.count ?? "N/D"}</strong>
                  </header>
                  <div className={styles.kanbanCards}>
                    {column.cards.map((card) => (
                      <Link className={styles.kanbanCard} href={`/app/leads/${card.id}`} key={card.id} prefetch={false}>
                        <strong>{card.name}</strong>
                        <span>
                          {card.assignedMembershipId
                            ? teamDirectory.namesByMembership[card.assignedMembershipId] ?? "Atribuído"
                            : "Sem responsável"}
                          <time dateTime={card.stageEnteredAt}>{formatWaitingTime(card.stageEnteredAt, now)}</time>
                        </span>
                      </Link>
                    ))}
                    {!column.cards.length ? <p className={styles.emptyColumn}>Nenhum lead</p> : null}
                    {hiddenCount ? <Link className={styles.remainingCount} href="/app/kanban">+{hiddenCount} no Kanban</Link> : null}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <p className={styles.sectionEmpty}>O pipeline ainda não possui etapas ativas.</p>
        )}
      </section>

      <header className={styles.actionsHeader}>
        <span>Próximas ações</span>
        <p>Exceções e compromissos que pedem continuidade.</p>
      </header>

      <div className={styles.operationalGrid}>
        <section className={styles.attentionSection} aria-labelledby="attention-title">
          <header className={styles.compactHeader}>
            <h2 id="attention-title">Precisa de atenção</h2>
            <Link href="/app/inbox">Ver todas</Link>
          </header>
          <div className={styles.attentionList}>
            {attentionItems.map((item) => (
              <Link className={styles.attentionRow} href={item.href} key={item.id} prefetch={false}>
                <span className={styles.attentionPerson}>
                  <strong>{item.name}</strong>
                  <small>{item.reason}</small>
                </span>
                <span className={styles.attentionAction}>
                  <time dateTime={item.waitingSince}>{formatWaitingTime(item.waitingSince, now)}</time>
                  <strong>{item.action}</strong>
                </span>
              </Link>
            ))}
            {!attentionItems.length ? (
              <p className={styles.compactEmpty}>
                <MessageSquareText aria-hidden="true" size={17} /> Nenhuma conversa pendente agora.
              </p>
            ) : null}
          </div>
        </section>

        <section className={styles.agendaSection} aria-labelledby="agenda-title">
          <header className={styles.compactHeader}>
            <h2 id="agenda-title">Agenda</h2>
            <Link href="/app/agenda">Abrir</Link>
          </header>
          <div className={styles.agendaList}>
            {agendaItems.map((item) => (
              <Link className={styles.agendaRow} href={item.href} key={item.id} prefetch={false}>
                <time dateTime={item.startsAt}>
                  {formatOperationDateTime(item.startsAt, timeZone, {
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    month: "2-digit",
                  })}
                </time>
                <strong>{item.name}</strong>
                <small>{formatCallType(item.format)}</small>
              </Link>
            ))}
            {!agendaItems.length ? (
              <p className={styles.compactEmpty}>
                <CalendarDays aria-hidden="true" size={17} /> Nenhuma call futura agendada.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      {managesTeam ? <HomologationCleanupPanel /> : null}
    </div>
  );
}
