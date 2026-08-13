import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Megaphone,
  RadioTower,
  ScrollText,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { claimEscalationAction, markNotificationReadAction, updateAlertAction } from "./actions";
import { PushSubscription } from "./push-subscription";
import styles from "../operations.module.css";

type LogSource = "ai" | "campaigns" | "integrations" | "system" | "errors" | "user";
type LogFilter = "all" | LogSource;

type LogEntry = {
  id: string;
  occurredAt: string;
  source: LogSource;
  type: string;
  description: string;
  status: string;
  tone: "neutral" | "positive" | "warning" | "danger" | "accent";
  href?: string;
  alertId?: string;
  escalationId?: string;
  notificationId?: string;
};

const filters: { id: LogFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "ai", label: "IA" },
  { id: "campaigns", label: "Campanhas" },
  { id: "integrations", label: "Integrações" },
  { id: "system", label: "Sistema" },
  { id: "errors", label: "Erros" },
  { id: "user", label: "Usuário" },
];

function getFilter(value: string | undefined): LogFilter {
  return filters.some((filter) => filter.id === value) ? value as LogFilter : "all";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    open: "Aberto",
    acknowledged: "Assumido",
    pending: "Pendente",
    unread: "Não lido",
    read: "Lido",
    healthy: "Saudável",
    active: "Ativo",
    running: "Em execução",
    assigned: "Atribuído",
    awaiting_distribution: "Aguardando distribuição",
    resolved: "Resolvido",
    completed: "Concluído",
    paused: "Pausado",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

function statusTone(status: string): LogEntry["tone"] {
  if (["open", "pending", "unread", "awaiting_distribution"].includes(status)) return "warning";
  if (["resolved", "read", "healthy", "completed", "assigned"].includes(status)) return "positive";
  if (["error", "failed", "critical", "down"].includes(status)) return "danger";
  if (["running", "active"].includes(status)) return "accent";
  return "neutral";
}

function sourceLabel(source: LogSource) {
  return filters.find((filter) => filter.id === source)?.label ?? "Sistema";
}

function sourceIcon(source: LogSource) {
  if (source === "ai") return <Bot aria-hidden="true" size={16} />;
  if (source === "campaigns") return <Megaphone aria-hidden="true" size={16} />;
  if (source === "integrations") return <RadioTower aria-hidden="true" size={16} />;
  if (source === "errors") return <AlertTriangle aria-hidden="true" size={16} />;
  if (source === "user") return <UserRound aria-hidden="true" size={16} />;
  return <ScrollText aria-hidden="true" size={16} />;
}

export default async function CentralPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; page?: string }>;
}) {
  const viewer = await requireActiveViewer();
  const params = await searchParams;
  const filter = getFilter(params.source);
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const supabase = await createClient();
  const operation = viewer.operations.find((item) => item.is_default) ?? viewer.operations[0];
  const [{ data: alerts }, { data: escalations }, { data: calls }, { data: campaigns }, { data: health }, { data: notifications }, { data: suggestions }] = await Promise.all([
    supabase.from("alerts").select("id,title,body,status,severity,category,created_at").eq("org_id", viewer.organization!.id).neq("status", "resolved").order("created_at", { ascending: false }).limit(30),
    supabase.from("escalations").select("id,category,reason,status,severity,created_at,conversation_id").eq("org_id", viewer.organization!.id).neq("status", "resolved").order("created_at", { ascending: false }).limit(30),
    supabase.from("calls").select("id,status,starts_at,format").eq("org_id", viewer.organization!.id).in("status", ["awaiting_distribution", "unassigned_alerted", "assigned"]).order("starts_at").limit(30),
    supabase.from("campaigns").select("id,name,status,updated_at").eq("org_id", viewer.organization!.id).in("status", ["review", "approved", "running", "paused"]).order("updated_at", { ascending: false }).limit(30),
    supabase.from("integration_health_checks").select("component,status,checked_at,error_redacted").eq("org_id", viewer.organization!.id).order("checked_at", { ascending: false }).limit(30),
    supabase.from("notifications").select("id,title,body,status,created_at").eq("recipient_membership_id", viewer.membership!.id).order("created_at", { ascending: false }).limit(30),
    supabase.from("ai_suggestions").select("id,status,created_at,conversation_id").eq("org_id", viewer.organization!.id).order("created_at", { ascending: false }).limit(30),
  ]);

  const entries: LogEntry[] = [
    ...(alerts ?? []).map((item) => ({
      id: `alert-${item.id}`,
      occurredAt: item.created_at,
      source: item.severity === "critical" ? "errors" as const : "system" as const,
      type: "Alerta",
      description: `${item.title}${item.body ? ` · ${item.body}` : ""}`,
      status: item.status,
      tone: statusTone(item.severity === "critical" ? "critical" : item.status),
      alertId: item.id,
    })),
    ...(escalations ?? []).map((item) => ({
      id: `escalation-${item.id}`,
      occurredAt: item.created_at,
      source: "ai" as const,
      type: `Escalada · ${item.category}`,
      description: item.reason,
      status: item.status,
      tone: statusTone(item.severity ?? item.status),
      href: item.conversation_id ? `/app/inbox/${item.conversation_id}` : "/app/conversas",
      escalationId: item.id,
    })),
    ...(suggestions ?? []).map((item) => ({
      id: `suggestion-${item.id}`,
      occurredAt: item.created_at,
      source: "ai" as const,
      type: "Sugestão do Pedro",
      description: "Uma sugestão de atendimento aguarda revisão na conversa.",
      status: item.status,
      tone: statusTone(item.status),
      href: item.conversation_id ? `/app/inbox/${item.conversation_id}` : "/app/conversas?view=unanswered",
    })),
    ...(campaigns ?? []).map((item) => ({
      id: `campaign-${item.id}`,
      occurredAt: item.updated_at,
      source: "campaigns" as const,
      type: "Campanha",
      description: item.name,
      status: item.status,
      tone: statusTone(item.status),
      href: "/app/campanhas",
    })),
    ...(health ?? []).map((item) => ({
      id: `health-${item.component}-${item.checked_at}`,
      occurredAt: item.checked_at,
      source: ["healthy", "ok", "connected"].includes(item.status) ? "integrations" as const : "errors" as const,
      type: "Integração",
      description: item.error_redacted ?? `${item.component} verificou a conexão.`,
      status: item.status,
      tone: statusTone(item.status),
      href: "/app/configuracoes/whatsapp",
    })),
    ...(calls ?? []).map((item) => ({
      id: `call-${item.id}`,
      occurredAt: item.starts_at,
      source: "system" as const,
      type: "Agendamento",
      description: `${item.format === "video" ? "Vídeo" : "Ligação"} prevista para ${new Intl.DateTimeFormat("pt-BR", { timeZone: operation?.timezone, dateStyle: "short", timeStyle: "short" }).format(new Date(item.starts_at))}.`,
      status: item.status,
      tone: statusTone(item.status),
      href: "/app/agenda",
    })),
    ...(notifications ?? []).map((item) => ({
      id: `notification-${item.id}`,
      occurredAt: item.created_at,
      source: "user" as const,
      type: "Notificação",
      description: `${item.title}${item.body ? ` · ${item.body}` : ""}`,
      status: item.status,
      tone: statusTone(item.status),
      notificationId: item.id,
    })),
  ].sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));

  const filteredEntries = filter === "all" ? entries : entries.filter((entry) => entry.source === filter);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const page = Math.min(Math.max(Number.isFinite(requestedPage) ? requestedPage : 1, 1), totalPages);
  const pageEntries = filteredEntries.slice((page - 1) * pageSize, page * pageSize);
  const hrefFor = (nextPage: number) => {
    const search = new URLSearchParams();
    if (filter !== "all") search.set("source", filter);
    search.set("page", String(nextPage));
    return `/app/central?${search.toString()}`;
  };

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Operação"
        title="Log Center"
        description="Um fluxo único para acompanhar IA, campanhas, integrações, sistema, erros e ações da equipe."
      >
        <StatusBadge tone="positive"><CheckCircle2 size={14} /> Atualizado agora</StatusBadge>
      </PageHeader>
      <PushSubscription publicKey={process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? ""} />

      <section className={styles.logPanel} aria-labelledby="log-center-title">
        <div className={styles.logToolbar}>
          <div><h2 id="log-center-title">Atividade operacional</h2><span>10 registros por página · mais recentes primeiro</span></div>
          <nav className={styles.logFilters} aria-label="Filtrar logs">
            {filters.map((item) => <Link className={item.id === filter ? styles.logFilterActive : styles.logFilter} href={`/app/central${item.id === "all" ? "" : `?source=${item.id}`}`} key={item.id}>{item.label}</Link>)}
          </nav>
        </div>
        <div className={styles.logList}>
          {pageEntries.map((entry) => (
            <article className={styles.logRow} key={entry.id}>
              <span className={`${styles.logIcon} ${styles[`logIcon${entry.source[0].toUpperCase()}${entry.source.slice(1)}`]}`}>{sourceIcon(entry.source)}</span>
              <time>{new Intl.DateTimeFormat("pt-BR", { timeZone: operation?.timezone, dateStyle: "short", timeStyle: "short" }).format(new Date(entry.occurredAt))}</time>
              <span className={styles.logOrigin}><strong>{sourceLabel(entry.source)}</strong><small>{entry.type}</small></span>
              <span className={styles.logDescription}>{entry.description}</span>
              <StatusBadge tone={entry.tone}>{statusLabel(entry.status)}</StatusBadge>
              <div className={styles.logAction}>
                {entry.alertId ? <form action={updateAlertAction}><input name="alertId" type="hidden" value={entry.alertId} /><input name="status" type="hidden" value="resolved" /><button title="Resolver alerta" type="submit">Resolver</button></form> : null}
                {entry.escalationId ? <form action={claimEscalationAction}><input name="escalationId" type="hidden" value={entry.escalationId} /><button title="Assumir escalada" type="submit">Assumir</button></form> : null}
                {entry.notificationId && entry.status !== "read" ? <form action={markNotificationReadAction}><input name="notificationId" type="hidden" value={entry.notificationId} /><button title="Marcar notificação como lida" type="submit">Ler</button></form> : null}
                {entry.href ? <Link href={entry.href} title="Abrir origem"><ArrowUpRight size={15} /></Link> : null}
              </div>
            </article>
          ))}
          {!pageEntries.length ? <div className={styles.empty}><ScrollText size={28} /><strong>Nenhum registro nesta visão</strong><span>Quando houver atividade, ela aparecerá aqui com origem e ação relacionada.</span></div> : null}
        </div>
        <footer className={styles.logPagination}>
          <span>{filteredEntries.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredEntries.length)} de ${filteredEntries.length}` : "0 registros"}</span>
          <div><Link aria-disabled={page <= 1} className={page <= 1 ? styles.paginationDisabled : styles.paginationButton} href={hrefFor(Math.max(page - 1, 1))}>Anterior</Link><span>Página {page} de {totalPages}</span><Link aria-disabled={page >= totalPages} className={page >= totalPages ? styles.paginationDisabled : styles.paginationButton} href={hrefFor(Math.min(page + 1, totalPages))}>Próxima</Link></div>
        </footer>
      </section>
    </div>
  );
}
