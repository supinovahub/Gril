import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { TypedConfirmationButton } from "@/components/typed-confirmation-button";
import { canManageTeam, requireActiveViewer } from "@/lib/auth/session";
import { loadInboxNotificationCounts } from "@/lib/inbox/notifications";
import { createClient } from "@/lib/supabase/server";
import { zonedLocalDateTimeToIso } from "@/lib/time/zoned-local";
import { purgeHomologationContextAction } from "./homologation-actions";
import styles from "./dashboard.module.css";

type HomologationPreview = {
  eligible: boolean;
  blocked: string[];
  counts: Record<string, number>;
};

type RecentConversation = {
  id: string;
  updated_at: string;
  last_message_preview: string | null;
  contacts: { name: string | null } | { name: string | null }[] | null;
};

function dateStringAt(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dayRange(timeZone: string) {
  const now = new Date();
  const localDate = dateStringAt(now, timeZone);
  const [year, month, day] = localDate.split("-").map(Number);
  const nextLocalDate = dateStringAt(new Date(Date.UTC(year, month - 1, day + 1)), "UTC");
  return {
    start: zonedLocalDateTimeToIso(`${localDate}T00:00`, timeZone),
    end: zonedLocalDateTimeToIso(`${nextLocalDate}T00:00`, timeZone),
  };
}

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ erro?: string; limpeza?: string }>;
}) {
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const managesTeam = canManageTeam(viewer);
  const feedback: { erro?: string; limpeza?: string } = searchParams ? await searchParams : {};
  const operation = viewer.operations.find((item) => item.is_default) ?? viewer.operations[0];
  const timeZone = operation?.timezone ?? "America/Sao_Paulo";
  const { start, end } = dayRange(timeZone);
  const now = new Date().toISOString();

  let homologationPreview: HomologationPreview | null = null;
  const [notifications, leadsTodayResult, inProgressResult, appointmentsResult, conversionsResult, recentResult] = await Promise.all([
    loadInboxNotificationCounts(supabase, viewer.organization!.id),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("org_id", viewer.organization!.id).gte("created_at", start).lt("created_at", end),
    supabase.from("conversations").select("id", { count: "exact", head: true }).eq("org_id", viewer.organization!.id).not("status", "in", "(closed,archived,completed,cancelled)"),
    supabase.from("calls").select("id", { count: "exact", head: true }).eq("org_id", viewer.organization!.id).gte("starts_at", now).not("status", "in", "(completed,cancelled,no_show)"),
    supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("org_id", viewer.organization!.id).eq("status", "won").gte("updated_at", start).lt("updated_at", end),
    supabase.from("conversations").select("id,updated_at,last_message_preview,contacts!inner(name)").eq("org_id", viewer.organization!.id).order("updated_at", { ascending: false }).limit(5),
  ]);

  if (managesTeam) {
    const { data } = await supabase.rpc("preview_homologation_context", { p_org_id: viewer.organization!.id });
    if (data) homologationPreview = data as unknown as HomologationPreview;
  }

  const recentConversations = (recentResult.data ?? []) as unknown as RecentConversation[];
  const recentErrors = [leadsTodayResult.error, inProgressResult.error, appointmentsResult.error, conversionsResult.error, recentResult.error].filter(Boolean);
  if (recentErrors.length) console.error("Failed to load dashboard overview metrics", recentErrors);

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Visão geral"
        title={`Bom dia, ${viewer.profile?.full_name.split(" ")[0] ?? "time"}`}
        description={`${viewer.organization!.name} em uma visão simples do que pede atenção e do que acontece hoje.`}
      >
        <StatusBadge tone="positive"><CheckCircle2 size={14} /> Operação ativa</StatusBadge>
      </PageHeader>

      {feedback.erro ? <p className={styles.feedbackError}>{feedback.erro}</p> : null}
      {feedback.limpeza === "concluida" ? <p className={styles.feedbackSuccess}>Contexto HML- limpo. Auditoria e configurações foram preservadas.</p> : null}
      {feedback.limpeza === "concluida-com-arquivos-pendentes" ? <p className={styles.feedbackWarning}>Contexto HML- limpo no banco, mas alguns arquivos não puderam ser removidos agora. Revise a auditoria e a retenção.</p> : null}
      {feedback.limpeza === "nenhum-contexto-elegivel" ? <p className={styles.feedbackSuccess}>Nenhum contexto HML- elegível foi encontrado.</p> : null}

      <section className={styles.attentionCard} aria-labelledby="attention-title">
        <div className={styles.attentionIcon}><MessageCircle size={22} /></div>
        <div className={styles.attentionCopy}>
          <p className={styles.eyebrow}>Atenção imediata</p>
          <h2 id="attention-title">{notifications.conversationsWithNotifications} {notifications.conversationsWithNotifications === 1 ? "conversa pede" : "conversas pedem"} uma ação</h2>
          <p>Mensagens novas e sugestões da IA ficam reunidas em Conversas, na ordem do próximo passo.</p>
        </div>
        <ButtonLink className={styles.attentionAction} href="/app/conversas?view=unanswered">Abrir atenção <ArrowUpRight size={15} /></ButtonLink>
      </section>

      <section className={styles.metricGrid} aria-label="Indicadores da operação">
        <MetricCard accent href="/app/conversas?view=unanswered" icon={<MessageCircle size={15} />} label="Conversas em atenção" value={notifications.conversationsWithNotifications} hint="agora" />
        <MetricCard href="/app/conversas" icon={<UsersRound size={15} />} label="Leads que chegaram hoje" value={leadsTodayResult.count ?? 0} hint={timeZone.replace("America/", "").replace("_", " ")} />
        <MetricCard href="/app/conversas?view=working" icon={<Sparkles size={15} />} label="Atendimentos em andamento" value={inProgressResult.count ?? 0} hint="conversas abertas" />
        <MetricCard href="/app/agenda" icon={<CalendarClock size={15} />} label="Agendamentos" value={appointmentsResult.count ?? 0} hint="a partir de agora" />
        <MetricCard icon={<CheckCircle2 size={15} />} label="Conversões" value={conversionsResult.count ?? 0} hint="ganhas hoje" />
      </section>

      <div className={styles.overviewGrid}>
        <section className={styles.activityPanel} aria-labelledby="recent-activity-title">
          <header className={styles.panelHeader}>
            <div><p className={styles.eyebrow}>Operação do dia</p><h2 id="recent-activity-title">Atividade recente</h2></div>
            <Link href="/app/conversas">Ver conversas <ArrowUpRight size={14} /></Link>
          </header>
          {recentConversations.length ? (
            <div className={styles.activityList}>
              {recentConversations.map((conversation) => {
                const contact = one(conversation.contacts);
                return (
                  <Link className={styles.activityRow} href={`/app/inbox/${conversation.id}`} key={conversation.id}>
                    <span className={styles.activityAvatar}>{contact?.name?.slice(0, 1).toUpperCase() ?? "?"}</span>
                    <span className={styles.activityCopy}><strong>{contact?.name ?? "Contato"}</strong><small>{conversation.last_message_preview || "Conversa criada sem mensagem"}</small></span>
                    <time>{new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(conversation.updated_at))}</time>
                  </Link>
                );
              })}
            </div>
          ) : <p className={styles.empty}>A atividade dos leads aparecerá aqui.</p>}
        </section>

        <aside className={styles.setupPanel} aria-labelledby="setup-title">
          <p className={styles.eyebrow}>Próximos passos</p>
          <h2 id="setup-title">Deixe a operação pronta</h2>
          <p>Uma sequência curta para atender com contexto e segurança.</p>
          <ol className={styles.setupList}>
            <li><span>1</span><Link href="/app/configuracoes/whatsapp"><strong>Conectar WhatsApp</strong><small>Receba mensagens na mesa de Conversas.</small></Link></li>
            <li><span>2</span><Link href="/app/conhecimento"><strong>Adicionar empreendimentos</strong><small>Publique informações que Pedro pode usar.</small></Link></li>
            <li><span>3</span><Link href="/app/pedro"><strong>Configurar o Pedro</strong><small>Comece revisando as sugestões.</small></Link></li>
          </ol>
        </aside>
      </div>

      {managesTeam ? (
        <details className={styles.adminDetails}>
          <summary><ShieldCheck size={15} /> Controles administrativos e homologação</summary>
          <div className={styles.adminDetailsBody}>
            <p>Esses controles ficam fora do fluxo principal para não competir com o atendimento diário.</p>
            <section className={styles.cleanupPanel} aria-labelledby="homologation-cleanup-title">
              <div>
                <p className={styles.eyebrow}>Operação protegida</p>
                <h2 id="homologation-cleanup-title">Limpar contexto de homologação</h2>
                <p>Remove somente registros de teste com prefixo <code>HML-</code> desta imobiliária. Configurações, equipe e auditoria ficam preservadas.</p>
              </div>
              {homologationPreview ? (
                <div className={styles.cleanupBody}>
                  <dl className={styles.cleanupCounts}>
                    <div><dt>Contatos</dt><dd>{homologationPreview.counts.contacts ?? 0}</dd></div>
                    <div><dt>Oportunidades</dt><dd>{homologationPreview.counts.opportunities ?? 0}</dd></div>
                    <div><dt>Conversas</dt><dd>{homologationPreview.counts.conversations ?? 0}</dd></div>
                    <div><dt>Mensagens</dt><dd>{homologationPreview.counts.messages ?? 0}</dd></div>
                    <div><dt>Chamadas</dt><dd>{homologationPreview.counts.calls ?? 0}</dd></div>
                    <div><dt>Jobs</dt><dd>{homologationPreview.counts.scheduled_jobs ?? 0}</dd></div>
                  </dl>
                  {homologationPreview.blocked?.length ? (
                    <div className={styles.cleanupBlocked}><strong>Limpeza bloqueada por segurança</strong><ul>{homologationPreview.blocked.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>
                  ) : homologationPreview.eligible ? (
                    <form action={purgeHomologationContextAction} className={styles.cleanupAction}><p>Exige digitar exatamente <code>CONFIRMAR AÇÃO</code>.</p><TypedConfirmationButton description="Somente registros HML- desta imobiliária serão removidos. Configurações, equipe e auditoria serão preservadas." title="Limpar contexto de homologação">Limpar contexto HML-</TypedConfirmationButton></form>
                  ) : <p className={styles.cleanupEmpty}>Nenhum registro HML- elegível para limpar.</p>}
                </div>
              ) : <p className={styles.cleanupEmpty}>Não foi possível carregar o preview.</p>}
            </section>
          </div>
        </details>
      ) : null}
    </div>
  );
}
