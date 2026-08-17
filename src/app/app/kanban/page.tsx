import { ArrowLeft, CircleDot, Clock3, UserRoundCheck, UsersRound } from "lucide-react";
import Link from "next/link";

import { requireActiveViewer } from "@/lib/auth/session";
import { measureServerTask } from "@/lib/observability/server-performance";
import { createClient } from "@/lib/supabase/server";
import { formatOperationDateTime } from "@/lib/time/operation-format";
import styles from "../leads/leads.module.css";

export default async function KanbanPage({
  searchParams,
}: {
  searchParams: Promise<{ responsavel?: string }>;
}) {
  const viewer = await requireActiveViewer();
  const query = await searchParams;
  const supabase = await createClient();
  const operation = viewer.operations.find((item) => item.is_default) ?? viewer.operations[0];
  const [{ data: stages }, { data: opportunities }] = await Promise.all([
    measureServerTask(
      "kanban.stages",
      () => supabase.from("pipeline_stages").select("*").eq("org_id", viewer.organization!.id).eq("is_active", true).order("position"),
    ),
    measureServerTask(
      "kanban.opportunity_list",
      () => supabase.from("kanban_opportunity_list").select("id,status,source,last_activity_at,pipeline_stage_id,assigned_membership_id,unit_quantity,amount_scope,contact_name,contact_status,primary_phone,latest_score,latest_score_explanation,latest_score_created_at").eq("org_id", viewer.organization!.id).eq("contact_status", "active").order("last_activity_at", { ascending: false }),
    ),
  ]);

  const allOpportunities = (opportunities ?? []).filter((item): item is typeof item & {
    id: string;
    last_activity_at: string;
  } => Boolean(item.id && item.last_activity_at));
  const showingUnassigned = query.responsavel === "pendente";
  const visibleOpportunities = showingUnassigned
    ? allOpportunities.filter((item) => !item.assigned_membership_id)
    : allOpportunities;
  const unassignedCount = allOpportunities.filter((item) => !item.assigned_membership_id).length;
  const recentThreshold = new Date().getTime() - (7 * 24 * 60 * 60 * 1000);
  const recentCount = allOpportunities.filter((item) => new Date(item.last_activity_at).getTime() >= recentThreshold).length;

  return (
    <div className={styles.pipelinePage}>
      <header className={styles.pipelineHeader}>
        <div>
          <Link className={styles.pipelineBack} href="/app"><ArrowLeft aria-hidden="true" size={14} /> Voltar à Visão geral</Link>
          <p className={styles.eyebrow}>Visão completa</p>
          <h1>Pipeline comercial</h1>
          <p>Acompanhe o avanço das oportunidades e abra o registro completo sem perder o contexto da etapa.</p>
        </div>
        <nav aria-label="Filtrar pipeline" className={styles.pipelineFilters}>
          <Link aria-current={!showingUnassigned ? "page" : undefined} className={!showingUnassigned ? styles.pipelineFilterActive : undefined} href="/app/kanban" prefetch={false}>Todos</Link>
          <Link aria-current={showingUnassigned ? "page" : undefined} className={showingUnassigned ? styles.pipelineFilterActive : undefined} href="/app/kanban?responsavel=pendente" prefetch={false}>Sem responsável</Link>
        </nav>
      </header>

      <section className={styles.pipelineSummary} aria-label="Resumo do pipeline">
        <span><UsersRound aria-hidden="true" size={17} /><small>Oportunidades</small><strong>{allOpportunities.length}</strong></span>
        <span><UserRoundCheck aria-hidden="true" size={17} /><small>Com responsável</small><strong>{allOpportunities.length - unassignedCount}</strong></span>
        <span><CircleDot aria-hidden="true" size={17} /><small>Etapas ativas</small><strong>{stages?.length ?? 0}</strong></span>
        <span><Clock3 aria-hidden="true" size={17} /><small>Movimentadas em 7 dias</small><strong>{recentCount}</strong></span>
      </section>

      <section className={styles.pipelineWorkspace} aria-label="Etapas do pipeline comercial">
        <div className={styles.pipelineWorkspaceHeader}>
          <span>{showingUnassigned ? "Oportunidades sem responsável" : "Todas as oportunidades"}</span>
          <small>Arraste horizontalmente para ver todas as etapas</small>
        </div>
        <div className={styles.kanbanBoard}>
          {stages?.map((stage, stageIndex) => {
            const cards = visibleOpportunities.filter((item) => item.pipeline_stage_id === stage.id);
            return (
              <section className={styles.kanbanColumn} key={stage.id}>
                <header>
                  <span><i aria-hidden="true">{String(stageIndex + 1).padStart(2, "0")}</i>{stage.name}</span>
                  <strong>{cards.length}</strong>
                </header>
                <div>
                  {cards.map((card) => {
                    const band = (card.latest_score_explanation as { band?: string } | null)?.band;
                    return (
                      <Link className={styles.kanbanCard} href={`/app/leads/${card.id}`} key={card.id} prefetch={false}>
                        <span className={styles.kanbanCardTop}><small>{card.source}</small>{card.latest_score !== null ? <b>{card.latest_score}/100</b> : null}</span>
                        <strong>{card.contact_name ?? "Contato"}</strong>
                        <span>{card.primary_phone ?? "Telefone não informado"}</span>
                        <span className={styles.kanbanCardMeta}>
                          <small>{card.assigned_membership_id ? "Com responsável" : "Sem responsável"}</small>
                          <small>{card.unit_quantity} {card.unit_quantity === 1 ? "unidade" : "unidades"}</small>
                        </span>
                        {band ? <small className={styles.kanbanScore}>{band}</small> : null}
                        <time>{formatOperationDateTime(card.last_activity_at, operation?.timezone)}</time>
                      </Link>
                    );
                  })}
                  {!cards.length ? <p className={styles.emptyColumn}>Nenhuma oportunidade nesta etapa</p> : null}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}
