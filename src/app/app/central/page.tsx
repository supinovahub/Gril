import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  RadioTower,
} from "lucide-react";
import Link from "next/link";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatOperationDateTime } from "@/lib/time/operation-format";
import { claimEscalationAction, markNotificationReadAction, updateAlertAction } from "./actions";
import { PushSubscription } from "./push-subscription";
import styles from "../operations.module.css";

const PAGE_SIZE = 10;

type RecordGroup = "attention" | "ai" | "calls" | "campaigns" | "integrations";
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
  priority?: string;
  href?: string;
};

const filterLabels: Array<{ value: "all" | RecordGroup; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "attention", label: "Atenção" },
  { value: "ai", label: "Pedro e Lionel" },
  { value: "calls", label: "Calls" },
  { value: "campaigns", label: "Campanhas" },
  { value: "integrations", label: "Integrações" },
];

function positivePage(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function recordIcon(source: RecordSource) {
  if (source === "alert" || source === "escalation") return <AlertTriangle aria-hidden="true" size={16} />;
  if (source === "notification") return <Bell aria-hidden="true" size={16} />;
  if (source === "thread") return <Bot aria-hidden="true" size={16} />;
  if (source === "call") return <CalendarClock aria-hidden="true" size={16} />;
  if (source === "campaign") return <Megaphone aria-hidden="true" size={16} />;
  return <RadioTower aria-hidden="true" size={16} />;
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
  const requestedFilter = filterLabels.some((item) => item.value === query.tipo) ? query.tipo! : "all";
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

  const records: CentralRecord[] = [
    ...(alertsResult.data ?? []).map((item) => ({
      id: String(item.id),
      source: "alert" as const,
      group: "attention" as const,
      title: item.title,
      description: item.body,
      status: item.status,
      meta: item.category,
      timestamp: item.created_at,
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
      priority: item.priority,
      href: `${item.assistant_role === "lionel" ? "/app/lionel" : "/app/chat-pedro"}?topico=${item.id}`,
    })),
    ...(callsResult.data ?? []).map((item) => ({
      id: item.id,
      source: "call" as const,
      group: "calls" as const,
      title: "Call em acompanhamento",
      description: item.format === "video" ? "Videochamada" : item.format === "phone" ? "Ligação" : "Formato a combinar",
      status: item.status,
      meta: "Agenda",
      timestamp: item.starts_at,
      href: "/app/agenda",
    })),
    ...(campaignsResult.data ?? []).map((item) => ({
      id: item.id,
      source: "campaign" as const,
      group: "campaigns" as const,
      title: item.name,
      description: "Campanha de reativação em acompanhamento.",
      status: item.status,
      meta: "Campanha",
      timestamp: item.updated_at,
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
      priority: item.status === "healthy" || item.status === "ok" ? "normal" : "high",
      href: "/app/configuracoes/whatsapp",
    })),
  ].sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());

  const filteredRecords = requestedFilter === "all" ? records : records.filter((item) => item.group === requestedFilter);
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, pageCount);
  const visibleRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const unresolvedAi = (threadsResult.data ?? []).filter((item) => item.requires_action).length + (escalationsResult.data ?? []).filter((item) => item.status === "open").length;
  const unhealthyIntegrations = latestHealth.filter((item) => item.status !== "healthy" && item.status !== "ok").length;

  function centralHref(page: number, filter = requestedFilter) {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("tipo", filter);
    if (page > 1) params.set("pagina", String(page));
    const suffix = params.toString();
    return suffix ? `/app/central?${suffix}` : "/app/central";
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Registro unificado</p>
          <h1>Central de operações</h1>
          <p>Pedro, Lionel e os eventos importantes da operação em uma única ordem cronológica.</p>
          <PushSubscription publicKey={process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? ""} />
        </div>
        <span className={styles.badge}>{operation?.name ?? "Sem operação"}</span>
      </header>

      {query.erro ? <p className={styles.error}>A ação não pôde ser concluída.</p> : null}

      <section className={styles.centralSummary} aria-label="Resumo da Central">
        <span><Activity aria-hidden="true" size={16} /><strong>{records.length}</strong> registros recentes</span>
        <span><Bot aria-hidden="true" size={16} /><strong>{unresolvedAi}</strong> pendências de IA</span>
        <span><RadioTower aria-hidden="true" size={16} /><strong>{unhealthyIntegrations}</strong> integrações com atenção</span>
      </section>

      <section className={styles.centralPanel}>
        <div className={styles.centralToolbar}>
          <nav aria-label="Filtrar registros da Central" className={styles.centralFilters}>
            {filterLabels.map((filter) => (
              <Link
                aria-current={requestedFilter === filter.value ? "page" : undefined}
                className={requestedFilter === filter.value ? styles.centralFilterActive : styles.centralFilter}
                href={centralHref(1, filter.value)}
                key={filter.value}
              >
                {filter.label}
              </Link>
            ))}
          </nav>
          <span>{PAGE_SIZE} por página</span>
        </div>

        <div className={styles.centralList}>
          {visibleRecords.map((record) => (
            <article className={styles.centralRecord} data-priority={record.priority ?? "normal"} key={`${record.source}-${record.id}`}>
              <span className={styles.centralRecordIcon}>{recordIcon(record.source)}</span>
              <span className={styles.centralRecordCopy}>
                <span><small>{record.meta}</small><b>{record.status}</b></span>
                <strong>{record.title}</strong>
                <p>{record.description}</p>
              </span>
              <time>{formatOperationDateTime(record.timestamp, operation?.timezone)}</time>
              <div className={styles.centralRecordActions}>
                {record.source === "alert" ? <>
                  {(alertsResult.data ?? []).find((item) => item.id === record.id)?.status === "open" ? <form action={updateAlertAction}><input name="alertId" type="hidden" value={record.id} /><input name="status" type="hidden" value="acknowledged" /><button>Assumir</button></form> : null}
                  <form action={updateAlertAction}><input name="alertId" type="hidden" value={record.id} /><input name="status" type="hidden" value="resolved" /><button className={styles.secondary}>Resolver</button></form>
                </> : null}
                {record.source === "notification" && (notificationsResult.data ?? []).find((item) => item.id === record.id)?.status !== "read" ? <form action={markNotificationReadAction}><input name="notificationId" type="hidden" value={record.id} /><button className={styles.secondary}>Marcar como lida</button></form> : null}
                {record.source === "escalation" && (escalationsResult.data ?? []).find((item) => item.id === record.id)?.status === "open" ? <form action={claimEscalationAction}><input name="escalationId" type="hidden" value={record.id} /><button>Assumir</button></form> : null}
                {record.href ? <Link href={record.href}>Abrir</Link> : null}
              </div>
            </article>
          ))}
          {!visibleRecords.length ? <div className={styles.centralEmpty}><CheckCircle2 aria-hidden="true" size={24} /><strong>Nenhum registro neste filtro</strong><span>A Central será atualizada quando houver nova atividade.</span></div> : null}
        </div>

        <footer className={styles.centralPagination}>
          <span>Página {currentPage} de {pageCount}</span>
          <div>
            {currentPage > 1 ? <Link href={centralHref(currentPage - 1)}><ChevronLeft aria-hidden="true" size={15} /> Anterior</Link> : <span aria-disabled="true"><ChevronLeft aria-hidden="true" size={15} /> Anterior</span>}
            {currentPage < pageCount ? <Link href={centralHref(currentPage + 1)}>Próxima <ChevronRight aria-hidden="true" size={15} /></Link> : <span aria-disabled="true">Próxima <ChevronRight aria-hidden="true" size={15} /></span>}
          </div>
        </footer>
      </section>
    </div>
  );
}
