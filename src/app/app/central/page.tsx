import {
  AlertTriangle,
  Bell,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History,
  Megaphone,
  RadioTower,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatOperationDateTime } from "@/lib/time/operation-format";
import { claimEscalationAction, markNotificationReadAction, updateAlertAction } from "./actions";
import { PushSubscription } from "./push-subscription";
import styles from "./central.module.css";

const PAGE_SIZE = 10;

type RecordGroup = "attention" | "ai" | "calls" | "campaigns" | "integrations";
type RecordView = "action" | "history" | RecordGroup;
type RecordSource = "alert" | "notification" | "escalation" | "thread" | "call" | "campaign" | "integration";

type CentralRecord = {
  id: string;
  source: RecordSource;
  group: RecordGroup;
  title: string;
  description: string;
  status: string;
  meta: string;
  timestamp: string;
  requiresAction: boolean;
  priority?: string;
  href?: string;
};

const filters: Array<{ value: RecordView; label: string }> = [
  { value: "action", label: "Precisa agir" },
  { value: "history", label: "Histórico" },
  { value: "ai", label: "Pedro e Lionel" },
  { value: "calls", label: "Agenda" },
  { value: "campaigns", label: "Campanhas" },
  { value: "integrations", label: "Integrações" },
];

const statusLabels: Record<string, string> = {
  acknowledged: "Em andamento",
  approved: "Pronta",
  assigned: "Atribuída",
  awaiting_distribution: "Aguardando distribuição",
  awaiting_manager: "Aguardando gestor",
  awaiting_response: "Aguardando resposta",
  cancelled: "Cancelado",
  degraded: "Com atenção",
  discussing: "Em discussão",
  error: "Com atenção",
  failed: "Com atenção",
  healthy: "Saudável",
  ok: "Saudável",
  open: "Aberto",
  paused: "Pausada",
  pending: "Pendente",
  read: "Lida",
  resolved: "Resolvido",
  review: "Em revisão",
  running: "Em andamento",
  unassigned_alerted: "Sem responsável",
};

const technicalLabels: Record<string, string> = {
  call_result: "Resultado de chamada",
  dead_letter: "Falha de automação",
  external_human_intervention: "Intervenção pelo celular",
  internal_chat: "Decisão interna",
};

const sourceRank: Record<RecordSource, number> = {
  alert: 7,
  escalation: 6,
  thread: 5,
  call: 4,
  campaign: 3,
  integration: 2,
  notification: 1,
};

function positivePage(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function recordIcon(source: RecordSource) {
  if (source === "alert" || source === "escalation") return <AlertTriangle aria-hidden="true" size={18} />;
  if (source === "notification") return <Bell aria-hidden="true" size={18} />;
  if (source === "thread") return <Bot aria-hidden="true" size={18} />;
  if (source === "call") return <CalendarClock aria-hidden="true" size={18} />;
  if (source === "campaign") return <Megaphone aria-hidden="true" size={18} />;
  return <RadioTower aria-hidden="true" size={18} />;
}

function humanizeLabel(value: string) {
  if (technicalLabels[value]) return technicalLabels[value];
  if (statusLabels[value]) return statusLabels[value];
  const normalized = value.replaceAll("_", " ").trim();
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "Sem estado";
}

function humanizeTitle(value: string) {
  if (value === "Job esgotou tentativas") return "Automação precisa de revisão";
  if (technicalLabels[value]) return technicalLabels[value];
  return value;
}

function humanizeDescription(value: string) {
  if (value.includes("call.result.escalate")) {
    return "A rotina de resultado de chamada falhou após novas tentativas e precisa de revisão manual.";
  }
  return value;
}

function recordFingerprint(record: CentralRecord) {
  const minute = record.timestamp.slice(0, 16);
  const text = `${record.title}|${record.description}`.toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
  return `${minute}|${text}`;
}

function recordScore(record: CentralRecord) {
  const action = record.requiresAction ? 100 : 0;
  const priority = record.priority === "critical" ? 30 : record.priority === "high" ? 20 : record.priority === "warning" ? 10 : 0;
  return action + priority + sourceRank[record.source];
}

function deduplicateRecords(records: CentralRecord[]) {
  const byEvent = new Map<string, CentralRecord>();
  for (const record of records) {
    const key = recordFingerprint(record);
    const current = byEvent.get(key);
    if (!current || recordScore(record) > recordScore(current)) byEvent.set(key, record);
  }
  return Array.from(byEvent.values()).sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );
}

function actionLabel(record: CentralRecord) {
  if (record.group === "ai") return "Abrir tópico";
  if (record.group === "calls") return "Abrir agenda";
  if (record.group === "campaigns") return "Abrir campanha";
  if (record.group === "integrations") return "Ver integração";
  return "Abrir";
}

export default async function CentralPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; pagina?: string; tipo?: string }>;
}) {
  const viewer = await requireActiveViewer();
  const query = await searchParams;
  const supabase = await createClient();
  const operation = viewer.operations.find((item) => item.is_default) ?? viewer.operations[0];
  const requestedFilter = filters.some((item) => item.value === query.tipo) ? query.tipo as RecordView : "action";
  const requestedPage = positivePage(query.pagina);

  let threadsQuery = supabase
    .from("internal_threads")
    .select("id,title,status,priority,requires_action,assistant_role,source,updated_at")
    .eq("org_id", viewer.organization!.id)
    .in("assistant_role", ["pedro", "lionel"])
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(80);
  if (operation) threadsQuery = threadsQuery.eq("operation_id", operation.id);

  const [alertsResult, escalationsResult, callsResult, campaignsResult, healthResult, notificationsResult, threadsResult] = await Promise.all([
    supabase.from("alerts").select("id,title,body,status,severity,category,created_at").eq("org_id", viewer.organization!.id).neq("status", "resolved").order("created_at", { ascending: false }).limit(80),
    supabase.from("escalations").select("id,category,reason,severity,status,created_at").eq("org_id", viewer.organization!.id).neq("status", "resolved").order("created_at", { ascending: false }).limit(80),
    supabase.from("calls").select("id,status,starts_at,format").eq("org_id", viewer.organization!.id).in("status", ["awaiting_manager", "awaiting_distribution", "unassigned_alerted", "assigned"]).order("starts_at").limit(80),
    supabase.from("campaigns").select("id,name,status,updated_at").eq("org_id", viewer.organization!.id).in("status", ["review", "approved", "running", "paused"]).order("updated_at", { ascending: false }).limit(80),
    supabase.from("integration_health_checks").select("id,component,status,checked_at,error_redacted").eq("org_id", viewer.organization!.id).order("checked_at", { ascending: false }).limit(80),
    supabase.from("notifications").select("id,title,body,status,created_at").eq("recipient_membership_id", viewer.membership!.id).order("created_at", { ascending: false }).limit(80),
    threadsQuery,
  ]);

  const resultError = [alertsResult, escalationsResult, callsResult, campaignsResult, healthResult, notificationsResult, threadsResult]
    .find((result) => result.error)?.error;
  if (resultError) {
    console.error("Failed to load Central records", resultError);
    throw new Error("Não foi possível carregar os registros da Central.");
  }

  const latestHealth = Object.values((healthResult.data ?? []).reduce<Record<string, NonNullable<typeof healthResult.data>[number]>>((acc, item) => {
    if (!acc[item.component]) acc[item.component] = item;
    return acc;
  }, {}));

  const records = deduplicateRecords([
    ...(alertsResult.data ?? []).map((item) => ({
      id: String(item.id),
      source: "alert" as const,
      group: "attention" as const,
      title: item.title,
      description: item.body,
      status: item.status,
      meta: item.category,
      timestamp: item.created_at,
      requiresAction: item.status === "open",
      priority: item.severity,
    })),
    ...(notificationsResult.data ?? []).map((item) => ({
      id: item.id,
      source: "notification" as const,
      group: "attention" as const,
      title: item.title,
      description: item.body,
      status: item.status,
      meta: "Notificação",
      timestamp: item.created_at,
      requiresAction: !["read", "cancelled"].includes(item.status),
      priority: item.status === "read" ? "normal" : "high",
    })),
    ...(escalationsResult.data ?? []).map((item) => ({
      id: item.id,
      source: "escalation" as const,
      group: "ai" as const,
      title: item.category,
      description: item.reason,
      status: item.status,
      meta: "Escalada do Pedro",
      timestamp: item.created_at,
      requiresAction: item.status === "open",
      priority: item.severity,
    })),
    ...(threadsResult.data ?? []).map((item) => ({
      id: item.id,
      source: "thread" as const,
      group: "ai" as const,
      title: item.title,
      description: item.requires_action ? "Aguardando uma decisão da equipe." : "Registro interno atualizado.",
      status: item.status,
      meta: item.assistant_role === "lionel" ? "Lionel" : "Pedro",
      timestamp: item.updated_at,
      requiresAction: item.requires_action,
      priority: item.priority,
      href: `${item.assistant_role === "lionel" ? "/app/lionel" : "/app/chat-pedro"}?topico=${item.id}`,
    })),
    ...(callsResult.data ?? []).map((item) => ({
      id: item.id,
      source: "call" as const,
      group: "calls" as const,
      title: "Chamada em acompanhamento",
      description: item.format === "video" ? "Videochamada" : item.format === "phone" ? "Ligação" : "Formato a combinar",
      status: item.status,
      meta: "Agenda",
      timestamp: item.starts_at,
      requiresAction: ["awaiting_manager", "awaiting_distribution", "unassigned_alerted"].includes(item.status),
      priority: item.status === "unassigned_alerted" ? "critical" : "high",
      href: "/app/agenda",
    })),
    ...(campaignsResult.data ?? []).map((item) => ({
      id: item.id,
      source: "campaign" as const,
      group: "campaigns" as const,
      title: item.name,
      description: item.status === "review" ? "A campanha aguarda revisão antes do próximo passo." : "Campanha de reativação em acompanhamento.",
      status: item.status,
      meta: "Campanha",
      timestamp: item.updated_at,
      requiresAction: ["review", "approved", "paused"].includes(item.status),
      priority: item.status === "review" ? "high" : "normal",
      href: "/app/campanhas",
    })),
    ...latestHealth.map((item) => ({
      id: String(item.id),
      source: "integration" as const,
      group: "integrations" as const,
      title: item.component,
      description: item.error_redacted ?? "Verificação concluída sem erro registrado.",
      status: item.status,
      meta: "Integração",
      timestamp: item.checked_at,
      requiresAction: item.status !== "healthy" && item.status !== "ok",
      priority: item.status === "healthy" || item.status === "ok" ? "normal" : "high",
      href: "/app/configuracoes/whatsapp",
    })),
  ]);

  const actionableRecords = records.filter((record) => record.requiresAction);
  const filteredRecords = requestedFilter === "action"
    ? actionableRecords
    : requestedFilter === "history"
      ? records
      : records.filter((record) => record.group === requestedFilter);
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, pageCount);
  const visibleRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const unresolvedAi = (threadsResult.data ?? []).filter((item) => item.requires_action).length;
  const unhealthyIntegrations = latestHealth.filter((item) => item.status !== "healthy" && item.status !== "ok").length;

  function centralHref(page: number, filter = requestedFilter) {
    const params = new URLSearchParams();
    if (filter !== "action") params.set("tipo", filter);
    if (page > 1) params.set("pagina", String(page));
    const suffix = params.toString();
    return suffix ? `/app/central?${suffix}` : "/app/central";
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Fila operacional</p>
          <h1>Central de operações</h1>
          <p>Veja primeiro o que exige decisão. O restante permanece disponível no histórico da operação.</p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.operationBadge}>{operation?.name ?? "Sem operação"}</span>
          <PushSubscription publicKey={process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? ""} />
        </div>
      </header>

      {query.erro ? <p className={styles.error} role="alert">A ação não pôde ser concluída. Tente novamente.</p> : null}

      <section className={styles.summary} aria-label="Resumo da Central">
        <span><Sparkles aria-hidden="true" size={18} /><small>Precisam de ação</small><strong>{actionableRecords.length}</strong></span>
        <span><Bot aria-hidden="true" size={18} /><small>Pedro e Lionel</small><strong>{unresolvedAi}</strong></span>
        <span><RadioTower aria-hidden="true" size={18} /><small>Integrações com atenção</small><strong>{unhealthyIntegrations}</strong></span>
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <nav aria-label="Filtrar registros da Central" className={styles.filters}>
            {filters.map((filter) => (
              <Link
                aria-current={requestedFilter === filter.value ? "page" : undefined}
                className={requestedFilter === filter.value ? styles.filterActive : styles.filter}
                href={centralHref(1, filter.value)}
                key={filter.value}
                prefetch={false}
              >
                {filter.value === "history" ? <History aria-hidden="true" size={14} /> : null}
                {filter.label}
              </Link>
            ))}
          </nav>
          <span>{filteredRecords.length} registros - {PAGE_SIZE} por página</span>
        </div>

        <div className={styles.list}>
          {visibleRecords.map((record) => (
            <article
              className={styles.record}
              data-priority={record.priority ?? "normal"}
              data-requires-action={record.requiresAction ? "true" : "false"}
              key={`${record.source}-${record.id}`}
            >
              <span className={styles.recordIcon}>{recordIcon(record.source)}</span>
              <div className={styles.recordCopy}>
                <div className={styles.recordMeta}>
                  <span>{humanizeLabel(record.meta)}</span>
                  <b>{humanizeLabel(record.status)}</b>
                </div>
                <strong>{humanizeTitle(record.title)}</strong>
                <p>{humanizeDescription(record.description)}</p>
              </div>
              <time dateTime={record.timestamp}>{formatOperationDateTime(record.timestamp, operation?.timezone)}</time>
              <div className={styles.recordActions}>
                {record.source === "alert" ? (
                  <>
                    {(alertsResult.data ?? []).find((item) => item.id === record.id)?.status === "open" ? (
                      <form action={updateAlertAction}>
                        <input name="alertId" type="hidden" value={record.id} />
                        <input name="status" type="hidden" value="acknowledged" />
                        <button>Assumir</button>
                      </form>
                    ) : null}
                    <form action={updateAlertAction}>
                      <input name="alertId" type="hidden" value={record.id} />
                      <input name="status" type="hidden" value="resolved" />
                      <button className={styles.secondary}>Resolver</button>
                    </form>
                  </>
                ) : null}
                {record.source === "notification" && !["read", "cancelled"].includes(record.status) ? (
                  <form action={markNotificationReadAction}>
                    <input name="notificationId" type="hidden" value={record.id} />
                    <button className={styles.secondary}>Marcar como lida</button>
                  </form>
                ) : null}
                {record.source === "escalation" && (escalationsResult.data ?? []).find((item) => item.id === record.id)?.status === "open" ? (
                  <form action={claimEscalationAction}>
                    <input name="escalationId" type="hidden" value={record.id} />
                    <button>Assumir</button>
                  </form>
                ) : null}
                {record.href ? <Link href={record.href} prefetch={false}>{actionLabel(record)}</Link> : null}
              </div>
            </article>
          ))}

          {!visibleRecords.length ? (
            <div className={styles.empty}>
              <CheckCircle2 aria-hidden="true" size={28} />
              <strong>{requestedFilter === "action" ? "Nada precisa de ação agora" : "Nenhum registro neste filtro"}</strong>
              <span>{requestedFilter === "action" ? "A operação está em dia. Novas pendências aparecerão aqui." : "Escolha outro filtro para continuar."}</span>
            </div>
          ) : null}
        </div>

        <footer className={styles.pagination}>
          <span>Página {currentPage} de {pageCount}</span>
          <div>
            {currentPage > 1 ? (
              <Link href={centralHref(currentPage - 1)}><ChevronLeft aria-hidden="true" size={15} /> Anterior</Link>
            ) : (
              <span aria-disabled="true"><ChevronLeft aria-hidden="true" size={15} /> Anterior</span>
            )}
            {currentPage < pageCount ? (
              <Link href={centralHref(currentPage + 1)}>Próxima <ChevronRight aria-hidden="true" size={15} /></Link>
            ) : (
              <span aria-disabled="true">Próxima <ChevronRight aria-hidden="true" size={15} /></span>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
