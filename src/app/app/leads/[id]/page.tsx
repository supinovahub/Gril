import {
  ArrowLeft,
  CalendarClock,
  Check,
  CircleAlert,
  History,
  Phone,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { changeStageAction, completeNextActionAction } from "../actions";
import styles from "../leads.module.css";

const allowedNext: Record<string, string[]> = {
  new: ["in_service", "lost"],
  in_service: ["call_scheduled", "lost"],
  call_scheduled: ["negotiation", "lost"],
  negotiation: ["proposal", "lost"],
  proposal: ["documentation", "lost"],
  documentation: ["payment", "lost"],
  payment: ["won", "lost"],
  lost: ["in_service"],
};

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const viewer = await requireActiveViewer();
  const { id } = await params;
  const feedback = await searchParams;
  const supabase = await createClient();

  const [opportunityResult, stagesResult, reasonsResult, historyResult, actionsResult, sourcesResult, salesResult] = await Promise.all([
    supabase
      .from("opportunities")
      .select("*, contacts!inner(id,name,status,contact_phones(*)), pipeline_stages!inner(id,name,code,position)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("pipeline_stages").select("*").eq("org_id", viewer.organization!.id).eq("is_active", true).order("position"),
    supabase.from("loss_reasons").select("id,name").eq("org_id", viewer.organization!.id).eq("is_active", true).order("name"),
    supabase.from("opportunity_stage_history").select("*, from:pipeline_stages!opportunity_stage_history_from_stage_id_org_id_fkey(name), to:pipeline_stages!opportunity_stage_history_to_stage_id_org_id_fkey(name)").eq("opportunity_id", id).order("created_at", { ascending: false }),
    supabase.from("next_actions").select("*").eq("opportunity_id", id).order("due_at"),
    supabase.from("source_attributions").select("*").eq("opportunity_id", id).order("attributed_at", { ascending: false }),
    supabase.from("sales").select("*").eq("opportunity_id", id).neq("status", "cancelled").maybeSingle(),
  ]);

  const opportunity = opportunityResult.data;
  if (!opportunity) notFound();

  const contact = Array.isArray(opportunity.contacts) ? opportunity.contacts[0] : opportunity.contacts;
  const stage = Array.isArray(opportunity.pipeline_stages) ? opportunity.pipeline_stages[0] : opportunity.pipeline_stages;
  const phones = (contact?.contact_phones ?? []) as Array<{
    e164: string;
    is_primary: boolean;
  }>;
  const nextCodes = new Set(allowedNext[stage?.code ?? ""] ?? []);
  const availableStages = stagesResult.data?.filter((item) => nextCodes.has(item.code)) ?? [];
  const isTerminal = opportunity.status === "won";

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} href="/app/leads"><ArrowLeft size={15} /> Voltar para leads</Link>

      <header className={styles.detailHeader}>
        <div className={styles.detailIdentity}>
          <span className={styles.largeAvatar}>{contact?.name?.slice(0, 1).toUpperCase()}</span>
          <div>
            <p className={styles.eyebrow}>Oportunidade · v{opportunity.version}</p>
            <h1>{contact?.name}</h1>
            <p>{opportunity.title} · {opportunity.source}</p>
          </div>
        </div>
        <span className={styles.currentStage}>{stage?.position}. {stage?.name}</span>
      </header>

      {feedback.erro ? <p className={styles.errorBanner}>{feedback.erro}</p> : null}
      {feedback.sucesso ? <p className={styles.successBanner}>Alteração salva com histórico e auditoria.</p> : null}

      <div className={styles.detailLayout}>
        <div className={styles.detailMain}>
          <section className={styles.detailCard}>
            <div className={styles.cardTitle}><UserRound size={18} /><h2>Contato e contexto</h2></div>
            <dl className={styles.factGrid}>
              <div><dt>WhatsApp</dt><dd><Phone size={14} /> {phones.find((item) => item.is_primary)?.e164 ?? "Não informado"}</dd></div>
              <div><dt>Responsável</dt><dd>{opportunity.assigned_membership_id ? opportunity.assigned_membership_id.slice(0, 8) : "Sem responsável"}</dd></div>
              <div><dt>Contexto para Pedro</dt><dd>{opportunity.ai_context || "Não informado"}</dd></div>
              <div><dt>Nota interna</dt><dd>{opportunity.internal_note || "Não informada"}</dd></div>
            </dl>
          </section>

          <section className={styles.detailCard}>
            <div className={styles.cardTitle}><CalendarClock size={18} /><h2>Próximas ações</h2></div>
            <div className={styles.actionList}>
              {actionsResult.data?.map((action) => (
                <div className={styles.actionRow} key={action.id}>
                  <span><strong>{action.description}</strong><small>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(action.due_at))}</small></span>
                  {action.status === "open" ? (
                    <form action={completeNextActionAction}>
                      <input name="actionId" type="hidden" value={action.id} />
                      <input name="opportunityId" type="hidden" value={opportunity.id} />
                      <button className={styles.iconAction} title="Concluir" type="submit"><Check size={16} /></button>
                    </form>
                  ) : <span className={styles.doneLabel}>{action.status}</span>}
                </div>
              ))}
              {!actionsResult.data?.length ? <p className={styles.mutedCopy}>Nenhuma próxima ação registrada.</p> : null}
            </div>
          </section>

          <section className={styles.detailCard}>
            <div className={styles.cardTitle}><History size={18} /><h2>Histórico de etapa</h2></div>
            <ol className={styles.timeline}>
              {historyResult.data?.map((item) => {
                const from = Array.isArray(item.from) ? item.from[0] : item.from;
                const to = Array.isArray(item.to) ? item.to[0] : item.to;
                return (
                  <li key={item.id}>
                    <span className={styles.timelineDot} />
                    <div><strong>{from?.name ? `${from.name} → ` : ""}{to?.name}</strong><small>{item.reason || "Mudança registrada"} · v{item.opportunity_version}</small></div>
                    <time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.created_at))}</time>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <aside className={styles.detailAside}>
          <section className={styles.stageFormCard}>
            <div className={styles.cardTitle}><CircleAlert size={18} /><h2>Avançar etapa</h2></div>
            {isTerminal ? (
              <p className={styles.terminalMessage}>Venda concluída é um estado imutável. Uma nova decisão de compra cria outra oportunidade.</p>
            ) : (
              <form action={changeStageAction} className={styles.stageForm}>
                <input name="opportunityId" type="hidden" value={opportunity.id} />
                <input name="expectedVersion" type="hidden" value={opportunity.version} />
                <label><span>Nova etapa</span><select name="targetStageId" required>{availableStages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label><span>Motivo / correção</span><textarea name="reason" rows={2} /></label>
                <label><span>Motivo de perda</span><select name="lossReasonId"><option value="">Somente se perdido</option>{reasonsResult.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <div className={styles.inlineFields}>
                  <label><span>Mês da venda</span><input max="12" min="1" name="saleMonth" type="number" /></label>
                  <label><span>Ano</span><input min="2020" name="saleYear" type="number" /></label>
                </div>
                <label><span>Empreendimento vendido</span><input name="saleProjectName" /></label>
                <label><span>Valor</span><input inputMode="decimal" name="saleValue" /></label>
                <label><span>Próxima ação</span><input name="nextActionDescription" /></label>
                <label><span>Prazo</span><input name="nextActionDueAt" type="datetime-local" /></label>
                <button className={styles.primaryButton} type="submit">Confirmar mudança</button>
              </form>
            )}
          </section>

          <section className={styles.compactCard}>
            <h3>Origem</h3>
            {sourcesResult.data?.map((source) => <p key={source.id}><strong>{source.source}</strong><span>{source.attribution_type} · {new Date(source.attributed_at).toLocaleDateString("pt-BR")}</span></p>)}
          </section>

          {salesResult.data ? (
            <section className={styles.saleCard}><strong>Venda registrada</strong><span>{salesResult.data.sale_month}/{salesResult.data.sale_year}</span><span>{salesResult.data.project_name || "Empreendimento não informado"}</span></section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
