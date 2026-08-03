import { FlaskConical, LockKeyhole } from "lucide-react";

import { requireActiveViewer } from "@/lib/auth/session";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { runRegressionAction, runSimulationAction } from "./actions";
import { SimulationAutoRefresh } from "./simulation-auto-refresh";
import styles from "../operations.module.css";
import simulatorStyles from "./simulator.module.css";

type SimulatorTrace = {
  action?: string;
  escalation_reason?: string | null;
  followup_strategy?: string;
  qualification_updates?: Array<{
    code: string;
    value_kind: string;
    value_text: string | null;
    value_number: number | null;
    value_boolean: boolean | null;
    confidence: number;
  }>;
  call_request?: { starts_at: string; format: string } | null;
  conversation_summary?: { summary: string; facts: string[] };
  context_trace?: {
    rule_version_id?: string | null;
    active_project_names?: string[];
    approved_sources?: string[];
    published_faq_count?: number;
  };
};

type Execution = {
  status: string;
  output_text: string | null;
  output_structured: Json;
  model_returned: string | null;
  latency_ms: number | null;
  estimated_cost: number | null;
  error_redacted: string | null;
};

const terminalStatuses = new Set(["completed", "failed", "superseded", "cancelled"]);

function valueFromUpdate(update: NonNullable<SimulatorTrace["qualification_updates"]>[number]) {
  if (update.value_kind === "number") return update.value_number?.toLocaleString("pt-BR") ?? "não informado";
  if (update.value_kind === "boolean") return update.value_boolean ? "sim" : "não";
  return update.value_text ?? update.value_kind;
}

export default async function SimulatorPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const viewer = await requireActiveViewer();
  const feedback = await searchParams;
  const supabase = await createClient();
  const [{ data: runs }, { data: regressions }] = await Promise.all([
    supabase.from("simulator_runs")
      .select("*,ai_executions(status,output_text,output_structured,model_returned,latency_ms,estimated_cost,error_redacted)")
      .eq("org_id", viewer.organization!.id).order("created_at", { ascending: false }).limit(30),
    supabase.from("regression_runs").select("*").eq("org_id", viewer.organization!.id).order("created_at", { ascending: false }).limit(10),
  ]);
  const hasPending = (runs ?? []).some((run) => {
    const execution = run.ai_executions as Execution | null;
    return !terminalStatuses.has(execution?.status ?? run.status);
  });

  return <div className={styles.page}>
    <SimulationAutoRefresh active={hasPending} />
    <header className={styles.header}><div><p className={styles.eyebrow}>Ambiente isolado</p><h1>Simulador</h1><p>Converse com o Pedro sem enviar WhatsApp, criar lead, agendar ou alterar o pipeline.</p></div><span className={styles.badge}><LockKeyhole size={13}/> sem efeitos externos</span></header>
    {feedback.erro ? <p className={styles.notice}>Não foi possível iniciar o cenário. Confira a mensagem e a configuração do modelo.</p> : null}
    {feedback.sucesso ? <p className={styles.success}>Cenário enviado. A resposta aparecerá automaticamente abaixo.</p> : null}
    <div className={styles.layout}>
      <main className={styles.stack}>
        <section className={styles.panel}><div className={styles.panelHeader}><h2>Regressão completa</h2><form action={runRegressionAction}><button>Executar {regressions?.[0]?.total_cases || 100} cenários</button></form></div><div className={styles.list}>{regressions?.map((run) => <article className={styles.item} key={run.id}><span><strong>{run.status} · {run.passed_cases}/{run.total_cases} aprovados</strong><small>{run.critical_failures} falhas críticas · criado em {new Date(run.created_at).toLocaleString("pt-BR")}</small></span></article>)}{!regressions?.length ? <p className={styles.empty}>Nenhuma regressão executada.</p> : null}</div></section>
        <section className={styles.panel}><div className={styles.panelHeader}><h2>Conversas simuladas</h2><FlaskConical size={17}/></div><div className={styles.list}>{runs?.map((run) => {
          const execution = run.ai_executions as Execution | null;
          const status = execution?.status ?? run.status;
          const trace = (execution?.output_structured ?? {}) as SimulatorTrace;
          const updates = trace.qualification_updates ?? [];
          const context = trace.context_trace;
          return <article className={simulatorStyles.simulation} key={run.id}>
            <div className={simulatorStyles.simulationHeader}><span><strong>{run.title}</strong><small>{new Date(run.created_at).toLocaleString("pt-BR")}</small></span><b>{status} · {execution?.model_returned ?? "aguardando modelo"}</b></div>
            <div className={simulatorStyles.userMessage}><small>Mensagem simulada</small><p>{run.simulated_input}</p></div>
            <div className={simulatorStyles.assistantMessage}><small>Pedro</small>{execution?.output_text ? <p>{execution.output_text}</p> : terminalStatuses.has(status) ? <p>{execution?.error_redacted ?? "A execução terminou sem resposta disponível."}</p> : <p>Processando a resposta…</p>}</div>
            {execution?.output_text ? <details className={simulatorStyles.trace}><summary>Ver decisão e contexto da IA</summary><div className={simulatorStyles.traceGrid}>
              <span><small>Próxima ação</small><strong>{trace.action ?? "responder"}</strong></span>
              <span><small>Follow-up</small><strong>{trace.followup_strategy ?? "nenhum"}</strong></span>
              <span><small>Latência</small><strong>{execution.latency_ms === null ? "—" : `${execution.latency_ms} ms`}</strong></span>
              <span><small>Custo estimado</small><strong>{execution.estimated_cost === null ? "—" : Number(execution.estimated_cost).toFixed(6)}</strong></span>
            </div>{trace.conversation_summary?.summary ? <p><strong>Resumo:</strong> {trace.conversation_summary.summary}</p> : null}{updates.length ? <div><strong>Qualificação extraída</strong><ul>{updates.map((update) => <li key={update.code}>{update.code}: {valueFromUpdate(update)} ({Math.round(update.confidence * 100)}%)</li>)}</ul></div> : <p>Nenhuma qualificação nova foi extraída neste turno.</p>}{trace.call_request ? <p><strong>Call proposta:</strong> {new Date(trace.call_request.starts_at).toLocaleString("pt-BR")} · {trace.call_request.format}</p> : null}{trace.escalation_reason ? <p><strong>Escalada:</strong> {trace.escalation_reason}</p> : null}{context ? <div><strong>Contexto aprovado enviado ao modelo</strong><ul>{context.rule_version_id ? <li>Versão de regras: {context.rule_version_id}</li> : null}{context.approved_sources?.length ? <li>Fontes: {context.approved_sources.join(", ")}</li> : null}{context.active_project_names?.length ? <li>Empreendimentos ativos: {context.active_project_names.join(", ")}</li> : null}<li>{context.published_faq_count ?? 0} FAQs publicadas disponíveis</li></ul></div> : null}</details> : null}
          </article>;
        })}{!runs?.length ? <p className={styles.empty}>Nenhuma simulação executada.</p> : null}</div></section>
      </main>
      <aside><form action={runSimulationAction} className={styles.formCard}><div><p className={styles.eyebrow}>Novo cenário</p><h2>Testar o Pedro</h2></div><label><span>Título</span><input name="title" required/></label><label><span>Mensagem simulada</span><textarea name="input" required rows={5}/></label><label><span>Estado inicial JSON</span><textarea className={styles.code} name="initialState" defaultValue={'{"qualification":{},"source":"simulator"}'} rows={6}/></label><button>Executar isoladamente</button></form></aside>
    </div>
  </div>;
}
