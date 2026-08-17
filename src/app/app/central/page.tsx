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
import { IntentPrefetchLink as Link } from "@/components/navigation/intent-prefetch-link";
import { redirect } from "next/navigation";

import { requireActiveViewer } from "@/lib/auth/session";
import { measureServerTask } from "@/lib/observability/server-performance";
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

type CentralFeedPayload = {
  actionableTotal: number;
  records: CentralRecord[];
  total: number;
  unhealthyIntegrations: number;
  unresolvedAi: number;
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

  const feedResult = await measureServerTask(
    "central.feed_page",
    () => supabase.rpc("central_feed_page", {
      p_limit: PAGE_SIZE,
      p_offset: (requestedPage - 1) * PAGE_SIZE,
      p_operation_id: operation?.id ?? null,
      p_org_id: viewer.organization!.id,
      p_view: requestedFilter,
    }),
  );
  if (feedResult.error) {
    console.error("Failed to load Central feed", feedResult.error);
    throw new Error("Não foi possível carregar os registros da Central.");
  }

  const feed = feedResult.data as unknown as CentralFeedPayload;
  const visibleRecords = Array.isArray(feed?.records) ? feed.records : [];
  const filteredRecordCount = Number(feed?.total ?? 0);
  const actionableRecordCount = Number(feed?.actionableTotal ?? 0);
  const unresolvedAi = Number(feed?.unresolvedAi ?? 0);
  const unhealthyIntegrations = Number(feed?.unhealthyIntegrations ?? 0);
  const pageCount = Math.max(1, Math.ceil(filteredRecordCount / PAGE_SIZE));

  function centralHref(page: number, filter = requestedFilter) {
    const params = new URLSearchParams();
    if (filter !== "action") params.set("tipo", filter);
    if (page > 1) params.set("pagina", String(page));
    const suffix = params.toString();
    return suffix ? `/app/central?${suffix}` : "/app/central";
  }

  if (requestedPage > pageCount) {
    redirect(centralHref(pageCount));
  }

  const currentPage = requestedPage;

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
        <span><Sparkles aria-hidden="true" size={18} /><small>Precisam de ação</small><strong>{actionableRecordCount}</strong></span>
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
          <span>{filteredRecordCount} registros - {PAGE_SIZE} por página</span>
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
                    {record.status === "open" ? (
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
                {record.source === "escalation" && record.status === "open" ? (
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
