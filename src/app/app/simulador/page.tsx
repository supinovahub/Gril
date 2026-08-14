import { Archive, ArchiveRestore, LockKeyhole, MessageSquarePlus } from "lucide-react";
import Link from "next/link";

import { requireActiveViewer } from "@/lib/auth/session";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

import {
  changeSimulationConversationStatusAction,
  continueSimulationConversationAction,
  runRegressionAction,
  startSimulationConversationAction,
} from "./actions";
import { ConversationMessages } from "./conversation-messages";
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
    persona_version_id?: string | null;
    active_project_names?: string[];
    approved_sources?: string[];
    published_faq_count?: number;
    simulator_turn_index?: number | null;
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

const terminalStatuses = new Set(["completed", "failed", "superseded", "cancelled", "blocked"]);

const statusLabels: Record<string, string> = {
  queued: "Na fila",
  running: "Respondendo",
  completed: "Concluída",
  failed: "Falhou",
  superseded: "Substituída",
  cancelled: "Cancelada",
  blocked: "Bloqueada",
};

const errorMessages: Record<string, string> = {
  "revise-o-cenario": "Revise o título, a mensagem inicial e o estado informado.",
  "revise-a-mensagem": "Escreva uma mensagem antes de continuar.",
  "estado-inicial-deve-ser-json": "O estado inicial precisa ser um JSON válido.",
  "aguarde-resposta-atual": "Aguarde a resposta atual antes de enviar outra mensagem ou arquivar a conversa.",
  "conversa-arquivada": "Restaure esta conversa antes de enviar uma nova mensagem.",
  "conversa-nao-encontrada": "A conversa simulada não foi encontrada ou você não tem acesso a ela.",
  "configure-modelo-e-chave": "Ative um modelo e confira a chave OpenAI da organização.",
  "regressao-ja-em-execucao": "Já existe uma regressão em execução.",
  "publique-regras-da-regressao": "Publique as regras principais antes de executar a regressão.",
  "sem-permissao-para-regressao": "Seu perfil não tem permissão para executar a regressão.",
  "regressao-indisponivel": "Não foi possível iniciar a regressão. Tente novamente; se persistir, acione o suporte.",
  "acao-invalida": "A ação solicitada não é válida.",
  "nao-foi-possivel-executar": "Não foi possível concluir a ação. Confira a configuração e tente novamente.",
};

const successMessages: Record<string, string> = {
  "conversa-iniciada": "Conversa criada. A primeira resposta aparecerá automaticamente.",
  "mensagem-enviada": "Mensagem enviada. O Pedro está preparando a resposta.",
  "conversa-arquivada": "Conversa arquivada. O histórico foi preservado.",
  "conversa-restaurada": "Conversa restaurada. Ela pode receber novas mensagens.",
  "regressao-iniciada": "Regressão iniciada.",
};

function valueFromUpdate(update: NonNullable<SimulatorTrace["qualification_updates"]>[number]) {
  if (update.value_kind === "number") return update.value_number?.toLocaleString("pt-BR") ?? "não informado";
  if (update.value_kind === "boolean") return update.value_boolean ? "sim" : "não";
  return update.value_text ?? update.value_kind;
}

function executionFromRun(run: { ai_executions: unknown }) {
  return run.ai_executions as Execution | null;
}

export default async function SimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string; conversa?: string; arquivadas?: string; nova?: string }>;
}) {
  const viewer = await requireActiveViewer();
  const feedback = await searchParams;
  const archivedView = feedback.arquivadas === "1";
  const supabase = await createClient();

  const [{ data: sessions }, { data: regressions }, { count: regressionCaseCount }] = await Promise.all([
    supabase
      .from("simulator_sessions")
      .select("id,title,status,turn_count,last_activity_at,created_at,archived_at")
      .eq("org_id", viewer.organization!.id)
      .eq("status", archivedView ? "archived" : "active")
      .order("last_activity_at", { ascending: false })
      .limit(50),
    supabase
      .from("regression_runs")
      .select("*")
      .eq("org_id", viewer.organization!.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("regression_cases")
      .select("id", { count: "exact", head: true })
      .eq("org_id", viewer.organization!.id)
      .eq("active", true),
  ]);

  const selectedSession = feedback.nova === "1"
    ? null
    : sessions?.find((session) => session.id === feedback.conversa)
      ?? sessions?.[0]
      ?? null;
  const { data: runs } = selectedSession
    ? await supabase
      .from("simulator_runs")
      .select("*,ai_executions(status,output_text,output_structured,model_returned,latency_ms,estimated_cost,error_redacted)")
      .eq("org_id", viewer.organization!.id)
      .eq("session_id", selectedSession.id)
      .order("turn_index", { ascending: true })
      .limit(100)
    : { data: [] };

  const hasPending = (runs ?? []).some((run) => {
    const execution = executionFromRun(run);
    return !terminalStatuses.has(execution?.status ?? run.status);
  });
  const regressionPending = (regressions ?? []).some((run) => ["queued", "running"].includes(run.status));
  const errorMessage = feedback.erro ? errorMessages[feedback.erro] ?? errorMessages["nao-foi-possivel-executar"] : null;
  const successMessage = feedback.sucesso ? successMessages[feedback.sucesso] : null;

  return <div className={styles.page}>
    <SimulationAutoRefresh active={hasPending || regressionPending} />
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Bancada de teste</p>
        <h1>Simulador</h1>
        <p>Converse continuamente com o Pedro sem criar lead, enviar WhatsApp, agendar ou alterar o pipeline.</p>
      </div>
      <span className={styles.badge}><LockKeyhole size={13} /> simulação sem envio ao lead</span>
    </header>

    {errorMessage ? <p className={styles.notice}>{errorMessage}</p> : null}
    {successMessage ? <p className={styles.success}>{successMessage}</p> : null}

    <section className={simulatorStyles.workspace}>
      <aside className={simulatorStyles.sessionsPanel}>
        <div className={simulatorStyles.sessionsHeader}>
          <div><p className={styles.eyebrow}>Histórico</p><h2>Conversas</h2></div>
          <Link className={simulatorStyles.newConversation} href="/app/simulador?nova=1" aria-label="Iniciar nova conversa simulada">
            <MessageSquarePlus size={17} /> Nova
          </Link>
        </div>
        <nav className={simulatorStyles.sessionFilters} aria-label="Filtrar conversas simuladas">
          <Link className={!archivedView ? simulatorStyles.activeFilter : undefined} href="/app/simulador">Ativas</Link>
          <Link className={archivedView ? simulatorStyles.activeFilter : undefined} href="/app/simulador?arquivadas=1">Arquivadas</Link>
        </nav>
        <div className={simulatorStyles.sessionList}>
          {(sessions ?? []).map((session) => {
            const href = `/app/simulador?${archivedView ? "arquivadas=1&" : ""}conversa=${session.id}`;
            return <Link
              aria-current={selectedSession?.id === session.id ? "page" : undefined}
              className={`${simulatorStyles.sessionItem} ${selectedSession?.id === session.id ? simulatorStyles.selectedSession : ""}`}
              href={href}
              key={session.id}
            >
              <strong>{session.title}</strong>
              <span>{session.turn_count} {session.turn_count === 1 ? "turno" : "turnos"}</span>
              <small>{new Date(session.last_activity_at).toLocaleString("pt-BR")}</small>
            </Link>;
          })}
          {!sessions?.length ? <div className={simulatorStyles.sessionEmpty}>
            <p>{archivedView ? "Nenhuma conversa arquivada." : "Nenhuma conversa ativa."}</p>
            {archivedView ? <Link href="/app/simulador">Ver conversas ativas</Link> : null}
          </div> : null}
        </div>
      </aside>

      <main className={simulatorStyles.chatPanel}>
        {selectedSession ? <>
          <div className={simulatorStyles.chatHeader}>
            <div>
              <p className={styles.eyebrow}>{selectedSession.status === "archived" ? "Somente consulta" : "Conversa em andamento"}</p>
              <h2>{selectedSession.title}</h2>
              <small>{selectedSession.turn_count} {selectedSession.turn_count === 1 ? "turno registrado" : "turnos registrados"}</small>
            </div>
            <form action={changeSimulationConversationStatusAction}>
              <input type="hidden" name="sessionId" value={selectedSession.id} />
              <input type="hidden" name="action" value={selectedSession.status === "archived" ? "restore" : "archive"} />
              <button className={simulatorStyles.archiveButton} disabled={hasPending}>
                {selectedSession.status === "archived" ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                {selectedSession.status === "archived" ? "Restaurar conversa" : "Arquivar conversa"}
              </button>
            </form>
          </div>

          <ConversationMessages
            className={simulatorStyles.messages}
            version={(runs ?? []).reduce((total, run) => {
              const execution = executionFromRun(run);
              return total + run.turn_index + (execution?.output_text ?? run.output_text ?? "").length;
            }, 0)}
          >
            {(runs ?? []).map((run) => {
              const execution = executionFromRun(run);
              const status = execution?.status ?? run.status;
              const outputText = execution?.output_text ?? run.output_text;
              const outputStructured = execution?.output_structured ?? run.output_structured ?? {};
              const trace = outputStructured as SimulatorTrace;
              const updates = trace.qualification_updates ?? [];
              const context = trace.context_trace;
              return <article className={simulatorStyles.turn} key={run.id}>
                <div className={simulatorStyles.turnMarker}>Turno {run.turn_index}</div>
                <div className={simulatorStyles.userMessage}><small>Você, como lead</small><p>{run.simulated_input}</p></div>
                <div className={simulatorStyles.assistantMessage}>
                  <div className={simulatorStyles.messageMeta}>
                    <small>Pedro</small>
                    <span>{statusLabels[status] ?? status}{execution?.model_returned ? ` · ${execution.model_returned}` : ""}</span>
                  </div>
                  {outputText
                    ? <p>{outputText}</p>
                    : terminalStatuses.has(status)
                      ? <p>{execution?.error_redacted ?? (status === "blocked" ? "Ative um modelo e confira a chave OpenAI." : "A execução terminou sem resposta disponível.")}</p>
                      : <p>Processando a resposta…</p>}
                </div>
                {outputText ? <details className={simulatorStyles.trace}>
                  <summary>Ver decisão e contexto deste turno</summary>
                  <div className={simulatorStyles.traceGrid}>
                    <span><small>Próxima ação</small><strong>{trace.action ?? "responder"}</strong></span>
                    <span><small>Follow-up</small><strong>{trace.followup_strategy ?? "nenhum"}</strong></span>
                    <span><small>Latência</small><strong>{execution?.latency_ms == null ? "Não disponível" : `${execution.latency_ms} ms`}</strong></span>
                    <span><small>Custo estimado</small><strong>{execution?.estimated_cost == null ? "Não disponível" : Number(execution.estimated_cost).toFixed(6)}</strong></span>
                  </div>
                  {trace.conversation_summary?.summary ? <p><strong>Resumo acumulado:</strong> {trace.conversation_summary.summary}</p> : null}
                  {updates.length ? <div><strong>Qualificação extraída</strong><ul>{updates.map((update) => <li key={update.code}>{update.code}: {valueFromUpdate(update)} ({Math.round(update.confidence * 100)}%)</li>)}</ul></div> : <p>Nenhuma qualificação nova foi extraída neste turno.</p>}
                  {trace.call_request ? <p><strong>Call proposta:</strong> {new Date(trace.call_request.starts_at).toLocaleString("pt-BR")} · {trace.call_request.format}</p> : null}
                  {trace.escalation_reason ? <p><strong>Escalada:</strong> {trace.escalation_reason}</p> : null}
                  {context ? <div><strong>Contexto aprovado enviado ao modelo</strong><ul>
                    {context.persona_version_id ? <li>Versão de persona: {context.persona_version_id}</li> : null}
                    {context.rule_version_id ? <li>Versão de regras: {context.rule_version_id}</li> : null}
                    {context.approved_sources?.length ? <li>Fontes: {context.approved_sources.join(", ")}</li> : null}
                    {context.active_project_names?.length ? <li>Empreendimentos ativos: {context.active_project_names.join(", ")}</li> : null}
                    <li>{context.published_faq_count ?? 0} FAQs publicadas disponíveis</li>
                  </ul></div> : null}
                </details> : null}
              </article>;
            })}
          </ConversationMessages>

          {selectedSession.status === "active" ? <form action={continueSimulationConversationAction} className={simulatorStyles.composer}>
            <input type="hidden" name="sessionId" value={selectedSession.id} />
            <label htmlFor="simulator-next-message">Continuar como lead</label>
            <textarea id="simulator-next-message" name="input" required rows={3} placeholder="Escreva a próxima mensagem da mesma conversa…" disabled={hasPending} />
            <div>
              <small>{hasPending ? "Aguarde a resposta atual para manter os turnos na ordem." : "O histórico e a qualificação acumulada serão enviados ao Pedro."}</small>
              <button disabled={hasPending}>{hasPending ? "Aguardando resposta…" : "Enviar mensagem"}</button>
            </div>
          </form> : <div className={simulatorStyles.archivedNotice}>
            <Archive size={18} />
            <p>Esta conversa está arquivada. Restaure-a para continuar; o histórico permanece intacto.</p>
          </div>}
        </> : archivedView ? <div className={simulatorStyles.chatEmpty}>
          <Archive size={28} />
          <h2>Nenhuma conversa arquivada</h2>
          <p>Conversas arquivadas aparecerão aqui e poderão ser restauradas.</p>
          <Link href="/app/simulador">Voltar às conversas ativas</Link>
        </div> : <form action={startSimulationConversationAction} className={simulatorStyles.newConversationForm}>
          <div><p className={styles.eyebrow}>Nova conversa</p><h2>Começar uma simulação</h2><p>Defina o cenário uma vez e continue enviando mensagens na mesma conversa.</p></div>
          <label><span>Título do cenário</span><input name="title" required placeholder="Ex.: Lead buscando apartamento no Centro" /></label>
          <label><span>Primeira mensagem do lead</span><textarea name="input" required rows={5} placeholder="Olá, estou procurando um apartamento…" /></label>
          <details className={simulatorStyles.initialState}>
            <summary>Configurar estado inicial (opcional)</summary>
            <label><span>JSON do estado inicial</span><textarea className={styles.code} name="initialState" defaultValue={'{"qualification":{},"source":"simulator"}'} rows={6} /></label>
          </details>
          <button>Iniciar conversa simulada</button>
        </form>}
      </main>
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div><p className={styles.eyebrow}>Validação em lote</p><h2>Regressão completa</h2></div>
        <form action={runRegressionAction}><button disabled={regressionPending}>{regressionPending ? "Lote em execução" : `Executar ${regressionCaseCount ?? regressions?.[0]?.total_cases ?? 0} cenários`}</button></form>
      </div>
      <div className={styles.list}>
        {regressions?.map((run) => <article className={styles.item} key={run.id}><span><strong>{run.status} · {run.passed_cases}/{run.total_cases} aprovados</strong><small>{run.critical_failures} falhas críticas · criado em {new Date(run.created_at).toLocaleString("pt-BR")}</small></span></article>)}
        {!regressions?.length ? <p className={styles.empty}>Nenhuma regressão executada.</p> : null}
      </div>
    </section>
  </div>;
}
