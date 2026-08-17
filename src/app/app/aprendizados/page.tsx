import {
  BookMarked,
  BrainCircuit,
  GitCompareArrows,
  Layers3,
  Play,
  ShieldCheck,
} from "lucide-react";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  createLearningAction,
  publishRuleVersionAction,
  requestMetaReviewAction,
  reviewLearningAction,
} from "./actions";
import styles from "../operations.module.css";
import learningStyles from "./learnings.module.css";

const reviewableStatuses = new Set(["new", "reviewing", "conflict"]);

const statusLabels: Record<string, string> = {
  new: "Aguardando revisão",
  reviewing: "Em revisão",
  approved: "Rascunho criado",
  rejected: "Descartado",
  conflict: "Conflito aberto",
  queued: "Na fila",
  running: "Analisando",
  completed: "Concluída",
  failed: "Falhou",
  blocked: "Bloqueada",
  passed: "Aprovada",
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
  open: "Aberto",
  drafted: "Em rascunho",
  resolved: "Resolvido",
  ignored: "Ignorado",
};

const scopeLabels: Record<string, string> = {
  style: "Tom e estilo",
  rule: "Regra comercial",
  faq: "Dúvida frequente",
  qualification: "Qualificação",
  scheduling: "Agendamento",
  escalation: "Escalada humana",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export default async function LearningsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const viewer = await requireActiveViewer();
  const feedback = await searchParams;
  const supabase = await createClient();
  const orgId = viewer.organization!.id;
  const [
    suggestionsResult,
    casesResult,
    runsResult,
    signalsResult,
    clustersResult,
    modulesResult,
    skillVersionsResult,
    ruleVersionsResult,
    reviewRunsResult,
  ] = await Promise.all([
    supabase.from("learning_suggestions")
      .select("id,source,observed_response,human_observation,suggested_change,scope,status,candidate_kind,conflict_details,target_skill_module_id,feedback_cluster_id,draft_rule_version_id,created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase.from("regression_cases")
      .select("id,title,severity,source,active")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("regression_runs")
      .select("id,rule_version_id,status,total_cases,passed_cases,critical_failures,created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("ai_feedback_signals")
      .select("id,status,severity,signal_type,occurred_at")
      .eq("org_id", orgId)
      .order("occurred_at", { ascending: false })
      .limit(200),
    supabase.from("ai_feedback_clusters")
      .select("id,title,failure_family,root_cause_layer,severity,confidence,status,observed_pattern,proposed_change,target_skill_code,target_skill_module_id,occurrence_count,evidence_count,last_seen_at")
      .eq("org_id", orgId)
      .order("last_seen_at", { ascending: false })
      .limit(50),
    supabase.from("ai_skill_modules")
      .select("id,code,name,category,description,status,created_at")
      .eq("org_id", orgId)
      .order("name"),
    supabase.from("ai_skill_versions")
      .select("id,module_id,version,status,instructions,trigger_config,created_at,published_at")
      .eq("org_id", orgId)
      .order("version", { ascending: false }),
    supabase.from("rule_versions")
      .select("id,version,status,created_at")
      .eq("org_id", orgId)
      .in("status", ["draft", "published"])
      .order("version", { ascending: false }),
    supabase.from("ai_review_runs")
      .select("id,source,status,signal_count,finding_count,model_returned,error_redacted,created_at,completed_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const suggestions = suggestionsResult.data ?? [];
  const cases = casesResult.data ?? [];
  const runs = runsResult.data ?? [];
  const signals = signalsResult.data ?? [];
  const clusters = clustersResult.data ?? [];
  const modules = modulesResult.data ?? [];
  const skillVersions = skillVersionsResult.data ?? [];
  const ruleVersions = ruleVersionsResult.data ?? [];
  const reviewRuns = reviewRunsResult.data ?? [];
  const pendingSuggestions = suggestions.filter((item) => reviewableStatuses.has(item.status));
  const openClusters = clusters.filter((item) => ["open", "reviewing"].includes(item.status));
  const newSignals = signals.filter((item) => item.status === "new");
  const activeModules = modules.filter((item) => item.status === "active");
  const clusterById = new Map(clusters.map((cluster) => [cluster.id, cluster]));
  const latestSkillByModule = new Map<string, (typeof skillVersions)[number]>();
  for (const version of skillVersions) {
    if (!latestSkillByModule.has(version.module_id)) latestSkillByModule.set(version.module_id, version);
  }
  const latestRunByRule = new Map<string, (typeof runs)[number]>();
  for (const run of runs) {
    if (!latestRunByRule.has(run.rule_version_id)) latestRunByRule.set(run.rule_version_id, run);
  }
  const drafts = ruleVersions.filter((item) => item.status === "draft");
  const canPublish = viewer.membership?.role === "owner";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Melhoria contínua com aprovação</p>
          <h1>Aprendizados</h1>
          <p>O sistema encontra padrões, Lionel prepara propostas e a equipe decide. Nada muda o Pedro sozinho.</p>
        </div>
        <form action={requestMetaReviewAction}>
          <button className={learningStyles.primaryAction} disabled={newSignals.length === 0} type="submit">
            <Play size={14} /> Analisar novos casos
          </button>
        </form>
      </header>

      {feedback.erro ? <p className={styles.error}>A ação não foi concluída: {feedback.erro.replaceAll("-", " ")}.</p> : null}
      {feedback.sucesso ? <p className={styles.success}>Alteração registrada: {feedback.sucesso.replaceAll("-", " ")}.</p> : null}

      <section className={styles.metrics} aria-label="Resumo da melhoria contínua">
        <article className={styles.metric}><small>Casos novos</small><strong>{newSignals.length}</strong></article>
        <article className={styles.metric}><small>Padrões em análise</small><strong>{openClusters.length}</strong></article>
        <article className={styles.metric}><small>Decisões pendentes</small><strong>{pendingSuggestions.length}</strong></article>
        <article className={styles.metric}><small>Skills ativas</small><strong>{activeModules.length}</strong></article>
      </section>

      <section className={learningStyles.flow} aria-label="Fluxo de melhoria">
        <span><BrainCircuit size={16} /><b>1. Observar</b><small>Correções, descartes, falhas e baixa confiança viram sinais.</small></span>
        <span><BookMarked size={16} /><b>2. Revisar</b><small>O meta-agente agrupa; Lionel leva a proposta para decisão.</small></span>
        <span><GitCompareArrows size={16} /><b>3. Testar</b><small>A aprovação cria rascunho e regressão, nunca publicação direta.</small></span>
        <span><ShieldCheck size={16} /><b>4. Publicar</b><small>Só o dono publica depois de todos os casos passarem.</small></span>
      </section>

      <div className={styles.layout}>
        <main className={styles.stack}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Fila de decisão humana</h2>
              <span>{pendingSuggestions.length} aguardando</span>
            </div>
            <div className={learningStyles.reviewList}>
              {suggestions.map((item) => {
                const cluster = item.feedback_cluster_id ? clusterById.get(item.feedback_cluster_id) : null;
                const isReviewable = reviewableStatuses.has(item.status);
                const suggestedCode = cluster?.target_skill_code
                  ?? `${item.scope}_${item.id.replaceAll("-", "").slice(0, 10)}`;
                const canBecomeSkill = item.source !== "pattern"
                  || (cluster?.root_cause_layer === "skill"
                    && ["example", "potential_rule"].includes(item.candidate_kind));
                return (
                  <article className={learningStyles.reviewItem} data-severity={cluster?.severity ?? "normal"} key={item.id}>
                    <header>
                      <span>
                        <small>{scopeLabels[item.scope] ?? item.scope} · {item.source === "pattern" ? "encontrado automaticamente" : "registrado pela equipe"}</small>
                        <strong>{item.human_observation}</strong>
                      </span>
                      <b>{statusLabels[item.status] ?? item.status}</b>
                    </header>
                    {item.observed_response ? <blockquote>{item.observed_response}</blockquote> : null}
                    <p><b>Proposta:</b> {item.suggested_change}</p>
                    {cluster ? (
                      <div className={learningStyles.evidenceLine}>
                        <span>{cluster.occurrence_count} ocorrências</span>
                        <span>{cluster.evidence_count} evidências</span>
                        <span>{Math.round(Number(cluster.confidence) * 100)}% de confiança</span>
                        <span>Causa provável: {cluster.root_cause_layer}</span>
                      </div>
                    ) : null}
                    {item.conflict_details ? <p className={styles.notice}>{item.conflict_details}</p> : null}
                    {isReviewable ? (
                      <details className={learningStyles.decisionBox} open={pendingSuggestions.length === 1}>
                        <summary>Revisar proposta e decidir</summary>
                        {canBecomeSkill ? <form action={reviewLearningAction}>
                          <input name="suggestionId" type="hidden" value={item.id} />
                          <input name="decision" type="hidden" value="approve_draft" />
                          <label>
                            <span>Comportamento existente</span>
                            <select defaultValue={item.target_skill_module_id ?? cluster?.target_skill_module_id ?? ""} name="targetSkillModuleId">
                              <option value="">Criar uma skill nova</option>
                              {activeModules.map((module) => <option key={module.id} value={module.id}>{module.name}</option>)}
                            </select>
                          </label>
                          <div className={learningStyles.twoColumns}>
                            <label><span>Código da nova skill</span><input defaultValue={suggestedCode} name="skillCode" pattern="[a-z0-9_]{3,80}" /></label>
                            <label><span>Nome da nova skill</span><input defaultValue={cluster?.title ?? `Comportamento de ${scopeLabels[item.scope] ?? item.scope}`} name="skillName" /></label>
                          </div>
                          <label><span>Quando aplicar</span><textarea defaultValue={cluster?.observed_pattern ?? item.human_observation} name="triggerDescription" rows={2} /></label>
                          <label><span>Instrução final</span><textarea defaultValue={item.suggested_change} name="finalInstructions" rows={4} /></label>
                          <p>Aprovar cria uma versão de skill, um pacote de regras em rascunho e executa a regressão completa.</p>
                          <button type="submit">Aprovar skill para testes</button>
                        </form> : <p className={styles.notice}>Este achado não foi classificado como uma mudança modular segura. Ele pode reforçar os testes, ser marcado como conflito ou ser descartado.</p>}
                        <div className={learningStyles.secondaryDecisions}>
                          <form action={reviewLearningAction}>
                            <input name="suggestionId" type="hidden" value={item.id} />
                            <input name="decision" type="hidden" value="approve_case" />
                            <button type="submit">Adicionar só como teste</button>
                          </form>
                          <form action={reviewLearningAction}>
                            <input name="suggestionId" type="hidden" value={item.id} />
                            <input name="decision" type="hidden" value="mark_conflict" />
                            <input name="reason" placeholder="Explique o conflito" />
                            <button type="submit">Marcar conflito</button>
                          </form>
                          <form action={reviewLearningAction}>
                            <input name="suggestionId" type="hidden" value={item.id} />
                            <input name="decision" type="hidden" value="reject" />
                            <button type="submit">Descartar</button>
                          </form>
                        </div>
                      </details>
                    ) : null}
                  </article>
                );
              })}
              {suggestions.length === 0 ? <p className={styles.empty}>Nenhuma proposta registrada.</p> : null}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}><h2>Padrões encontrados</h2><BrainCircuit size={17} /></div>
            <div className={styles.list}>
              {clusters.map((cluster) => (
                <article className={styles.item} key={cluster.id}>
                  <span>
                    <strong>{cluster.title}</strong>
                    <small>{cluster.observed_pattern}</small>
                    <b>{cluster.occurrence_count} ocorrências · {statusLabels[cluster.status] ?? cluster.status}</b>
                  </span>
                  <span className={learningStyles.severity} data-severity={cluster.severity}>{cluster.severity}</span>
                </article>
              ))}
              {clusters.length === 0 ? <p className={styles.empty}>A análise ainda não encontrou padrões recorrentes.</p> : null}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}><h2>Comportamentos modulares</h2><Layers3 size={17} /></div>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead><tr><th>Skill</th><th>Categoria</th><th>Versão</th><th>Situação</th></tr></thead>
                <tbody>
                  {activeModules.map((module) => {
                    const version = latestSkillByModule.get(module.id);
                    return <tr key={module.id}><td><strong>{module.name}</strong><br /><small>{module.code}</small></td><td>{scopeLabels[module.category] ?? module.category}</td><td>{version ? `v${version.version}` : "—"}</td><td>{version ? statusLabels[version.status] ?? version.status : "Sem versão"}</td></tr>;
                  })}
                </tbody>
              </table>
            </div>
            {activeModules.length === 0 ? <p className={styles.empty}>A primeira skill será criada quando uma proposta for aprovada para testes.</p> : null}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}><h2>Testes e publicação</h2><GitCompareArrows size={17} /></div>
            <div className={learningStyles.releaseList}>
              {drafts.map((draft) => {
                const run = latestRunByRule.get(draft.id);
                const ready = run?.status === "passed" && run.critical_failures === 0 && run.passed_cases === run.total_cases && run.total_cases > 0;
                return (
                  <article key={draft.id}>
                    <span><strong>Pacote v{draft.version}</strong><small>{run ? `${run.passed_cases}/${run.total_cases} casos · ${run.critical_failures} falhas críticas` : "Teste ainda não iniciado"}</small></span>
                    <b data-ready={ready}>{ready ? "Pronto para publicar" : statusLabels[run?.status ?? "queued"] ?? run?.status}</b>
                    {ready && canPublish ? <form action={publishRuleVersionAction}><input name="ruleVersionId" type="hidden" value={draft.id} /><button type="submit">Publicar skills</button></form> : null}
                  </article>
                );
              })}
              {drafts.length === 0 ? <p className={styles.empty}>Nenhum pacote de mudança aguardando testes.</p> : null}
            </div>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead><tr><th>Execução</th><th>Status</th><th>Casos</th><th>Críticos</th></tr></thead>
                <tbody>{runs.slice(0, 10).map((run) => <tr key={run.id}><td>{formatDate(run.created_at)}</td><td>{statusLabels[run.status] ?? run.status}</td><td>{run.passed_cases}/{run.total_cases}</td><td>{run.critical_failures}</td></tr>)}</tbody>
              </table>
            </div>
            <p className={styles.definition}>{cases.filter((item) => item.active).length} casos ativos. Publicação exige todos aprovados e nenhuma falha crítica.</p>
          </section>
        </main>

        <aside className={styles.stack}>
          <form action={createLearningAction} className={styles.formCard}>
            <div><p className={styles.eyebrow}>Observação da equipe</p><h2>Registrar um caso</h2></div>
            <p className={styles.definition}>Use para uma correção que aconteceu fora do modo assistido. Ela entra na mesma fila e não muda o Pedro diretamente.</p>
            <label><span>Resposta observada</span><textarea name="observedResponse" rows={3} /></label>
            <label><span>O que precisa melhorar</span><textarea name="observation" required rows={3} /></label>
            <label><span>Mudança sugerida</span><textarea name="suggestedChange" required rows={4} /></label>
            <label><span>Escopo</span><select name="scope"><option value="rule">Regra comercial</option><option value="style">Tom e estilo</option><option value="faq">Dúvida frequente</option><option value="qualification">Qualificação</option><option value="scheduling">Agendamento</option><option value="escalation">Escalada humana</option></select></label>
            <label><span>Skill existente, se houver</span><select name="targetSkillModuleId"><option value="">Criar após a revisão</option>{activeModules.map((module) => <option key={module.id} value={module.id}>{module.name}</option>)}</select></label>
            <button type="submit">Enviar para revisão</button>
          </form>

          <section className={styles.panel}>
            <div className={styles.panelHeader}><h2>Revisor automático</h2><BrainCircuit size={17} /></div>
            <div className={styles.list}>
              {reviewRuns.map((run) => <article className={styles.item} key={run.id}><span><strong>{run.source === "automatic" ? "Ciclo automático" : "Análise solicitada"}</strong><small>{formatDate(run.created_at)} · {run.signal_count} sinais · {run.finding_count} padrões</small>{run.error_redacted ? <small>{run.error_redacted}</small> : null}</span><b>{statusLabels[run.status] ?? run.status}</b></article>)}
              {reviewRuns.length === 0 ? <p className={styles.empty}>Nenhuma análise executada.</p> : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
