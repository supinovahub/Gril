import { Bot, CheckCircle2, CircleAlert, Clock3, CornerUpLeft, ExternalLink, Filter, Send, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";

import type { Tables } from "@/lib/database.types";
import { createLearningCandidateAction, resolveExternalInterventionAction, reviewAiSuggestionFromChatAction, sendInternalMessageAction } from "@/app/app/chat-interno/actions";
import styles from "./internal-chat-workspace.module.css";

type Thread = Tables<"internal_threads">;
type Message = Tables<"internal_messages">;
type AssistedSuggestionProposal = {
  suggestionId: string;
  conversationId: string;
  expectedVersion: number;
  body: string;
  status: string;
  analyzedMessage?: string;
  analyzedMessageAt?: string;
  contextSummary?: string;
};

const statusLabels: Record<string, string> = {
  awaiting_response: "Aguardando resposta",
  discussing: "Em discussão",
  awaiting_confirmation: "Aguardando confirmação",
  resolved: "Resolvido",
  invalidated: "Contexto alterado",
  archived: "Arquivado",
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function assistedSuggestionProposal(message: Message): AssistedSuggestionProposal | null {
  if (message.message_kind !== "proposal" || typeof message.metadata !== "object" || message.metadata === null || Array.isArray(message.metadata)) return null;
  const metadata = message.metadata as Record<string, unknown>;
  if (metadata.case_kind !== "assisted_suggestion") return null;
  if (typeof metadata.suggestion_id !== "string" || typeof metadata.conversation_id !== "string" || typeof metadata.suggestion_body !== "string") return null;
  const expectedVersion = typeof metadata.expected_conversation_version === "number"
    ? metadata.expected_conversation_version
    : Number(metadata.expected_conversation_version);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) return null;
  return {
    suggestionId: metadata.suggestion_id,
    conversationId: metadata.conversation_id,
    expectedVersion,
    body: metadata.suggestion_body,
    status: typeof metadata.status === "string" ? metadata.status : "pending",
    analyzedMessage: typeof metadata.analyzed_message === "string" && metadata.analyzed_message.trim() ? metadata.analyzed_message : undefined,
    analyzedMessageAt: typeof metadata.analyzed_message_at === "string" ? metadata.analyzed_message_at : undefined,
    contextSummary: typeof metadata.context_summary === "string" && metadata.context_summary.trim() ? metadata.context_summary : undefined,
  };
}

const proposalStatusLabels: Record<string, string> = {
  pending: "Aguardando aprovação",
  approved: "Enviada ao lead",
  rejected: "Descartada",
  processed: "Processada",
};

const threadTypeLabels: Record<string, string> = {
  general: "Conversa geral",
  lead_case: "Caso de lead",
  broker_assistant: "Apoio ao corretor",
  learning: "Aprendizado",
  incident: "Incidente",
};

const sourceLabels: Record<string, string> = {
  manual: "Aberto pela equipe",
  escalation: "Escalado pelo Pedro",
  assisted_correction: "Correção assistida",
  external_device: "Intervenção externa",
  post_call: "Pós-call",
  runtime_failure: "Falha de execução",
};

const priorityLabels: Record<string, string> = {
  low: "baixa",
  normal: "normal",
  high: "alta",
  critical: "crítica",
};

const statusFilterOptions = [
  ["awaiting_response", "Aguardando resposta"],
  ["discussing", "Em discussão"],
  ["awaiting_confirmation", "Aguardando confirmação"],
  ["resolved", "Resolvido"],
] as const;

const priorityFilterOptions = [
  ["low", "Baixa"],
  ["normal", "Normal"],
  ["high", "Alta"],
  ["critical", "Crítica"],
] as const;

type WorkspaceFilters = {
  search?: string;
  status?: string;
  priority?: string;
  requiresAction?: boolean;
};

function threadHref(basePath: string, threadId: string, filters?: WorkspaceFilters) {
  const params = new URLSearchParams();
  params.set("topico", threadId);
  if (filters?.search) params.set("busca", filters.search);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.priority) params.set("prioridade", filters.priority);
  if (filters?.requiresAction) params.set("pendencia", "1");
  return `${basePath}?${params.toString()}`;
}

export function InternalChatWorkspace({
  title,
  eyebrow,
  description,
  basePath,
  assistant,
  threads,
  activeThread,
  messages,
  emptyText,
  replyToMessageId,
  feedback,
  filters,
}: {
  title: string;
  eyebrow: string;
  description: string;
  basePath: string;
  assistant: "pedro" | "lionel";
  threads: Thread[];
  activeThread: Thread | null;
  messages: Message[];
  emptyText: string;
  replyToMessageId?: string;
  feedback?: { error?: string; success?: string };
  filters?: WorkspaceFilters;
}) {
  const pendingCount = threads.filter((thread) => thread.requires_action).length;
  const hasFilters = Boolean(filters?.search || filters?.status || filters?.priority || filters?.requiresAction);
  const assistantLabel = assistant === "lionel" ? "Curadoria guiada" : "Apoio à operação";
  const activeNeedsDecision = activeThread?.requires_action === true;
  const decisionTitle = activeThread
    ? activeThread.status === "invalidated"
      ? "Atualize o contexto antes de decidir"
      : activeNeedsDecision
        ? assistant === "lionel" ? "Revise o consenso antes de registrar" : "Revise a sugestão antes de enviar"
        : assistant === "lionel" ? "Responda à próxima pergunta do Lionel" : "Descreva o próximo impasse da operação"
    : "Selecione um tópico para começar";
  const decisionDescription = activeThread
    ? activeThread.status === "invalidated"
      ? "Uma mensagem nova ou mudança operacional deixou a análise anterior desatualizada. Consulte o contexto e peça uma nova análise."
      : activeNeedsDecision
        ? assistant === "lionel" ? "O tópico precisa de uma decisão humana. Confira escopo, exceções e evidências antes de criar um candidato."
          : "A proposta só afeta o lead depois que você aprovar. Edite o texto se necessário ou abra o Inbox para conferir a conversa completa."
        : assistant === "lionel" ? "Lionel conduz a curadoria uma pergunta por vez; o consenso só vira candidato quando você confirmar."
          : "Pedro organiza o contexto e sugere um caminho. Use este tópico para tirar dúvidas sem enviar nada automaticamente ao lead."
    : "A fila reúne conversas gerais, casos de lead e pendências que precisam da equipe.";
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <span className={styles.modeBadge}><Sparkles size={14} /> {assistantLabel}</span>
      </header>
      {feedback?.error ? <p className={styles.feedbackError}>{feedback.error}</p> : null}
      {feedback?.success ? <p className={styles.feedbackSuccess}>{feedback.success}</p> : null}

      <div className={styles.workspace}>
        <aside className={styles.topicRail} aria-label={assistant === "lionel" ? "Fila de curadoria" : "Fila de tópicos"}>
          <div className={styles.railHeader}>
            <div><span>{assistant === "lionel" ? "Fila de curadoria" : "Fila operacional"}</span><small>{threads.length}</small></div>
            <em>{pendingCount} pendência{pendingCount === 1 ? "" : "s"}</em>
          </div>
          <form className={styles.railFilters} method="get">
            <label htmlFor={`${assistant}-topic-search`}>Encontrar tópico</label>
            <div className={styles.searchField}>
              <Filter size={14} />
              <input defaultValue={filters?.search} id={`${assistant}-topic-search`} maxLength={80} name="busca" placeholder="Buscar pelo título" />
            </div>
            <div className={styles.filterGrid}>
              <select aria-label="Filtrar por status" defaultValue={filters?.status ?? ""} name="status">
                <option value="">Todos os status</option>
                {statusFilterOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select aria-label="Filtrar por prioridade" defaultValue={filters?.priority ?? ""} name="prioridade">
                <option value="">Todas prioridades</option>
                {priorityFilterOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <label className={styles.checkboxFilter}><input defaultChecked={filters?.requiresAction} name="pendencia" type="checkbox" value="1" /> Só pendências</label>
            <div className={styles.filterActions}>
              <button type="submit">Filtrar</button>
              {hasFilters ? <Link href={basePath}>Limpar</Link> : null}
            </div>
          </form>
          <nav className={styles.topicList}>
            {threads.map((thread) => (
              <Link
                className={`${styles.topicItem}${activeThread?.id === thread.id ? ` ${styles.topicItemActive}` : ""}`}
                href={threadHref(basePath, thread.id, filters)}
                key={thread.id}
                prefetch={false}
              >
                <span className={styles.topicPulse} data-priority={thread.priority} />
                <span className={styles.topicCopy}>
                  <strong>{thread.title}</strong>
                  <small>{threadTypeLabels[thread.thread_type] ?? thread.thread_type} · {statusLabels[thread.status] ?? thread.status}</small>
                </span>
                {thread.requires_action ? <CircleAlert aria-label="Ação necessária" size={15} /> : <span className={styles.topicPriority}>{priorityLabels[thread.priority] ?? thread.priority}</span>}
              </Link>
            ))}
            {!threads.length ? <p className={styles.emptyRail}>{emptyText}</p> : null}
          </nav>
        </aside>

        <section className={styles.chatPanel}>
          {activeThread ? (
            <>
              <header className={styles.chatHeader}>
                <div><h2>{activeThread.title}</h2><p>{threadTypeLabels[activeThread.thread_type] ?? activeThread.thread_type} · {statusLabels[activeThread.status] ?? activeThread.status}</p></div>
                <div className={styles.chatHeaderActions}>
                  <span className={styles.priorityTag} data-priority={activeThread.priority}>Prioridade {priorityLabels[activeThread.priority] ?? activeThread.priority}</span>
                  <span><Clock3 size={14} /> atualizado {dateLabel(activeThread.updated_at)}</span>
                  {activeThread.conversation_id ? <Link href={`/app/inbox/${activeThread.conversation_id}`}><ExternalLink size={13} /> Abrir no Inbox</Link> : null}
                </div>
              </header>
              <div className={styles.decisionCard} data-assistant={assistant} data-pending={activeNeedsDecision}>
                <div className={styles.decisionCardHeader}><span>{activeNeedsDecision ? <CircleAlert size={15} /> : <CheckCircle2 size={15} />}</span><div><small>Próximo passo</small><strong>{decisionTitle}</strong></div></div>
                <p>{decisionDescription}</p>
                <div className={styles.decisionMeta}><span>{sourceLabels[activeThread.source] ?? activeThread.source}</span><span>{activeThread.conversation_id ? "Ligado a uma conversa do Inbox" : "Contexto interno"}</span></div>
              </div>
              <div className={styles.messages}>
                {messages.map((message) => {
                  const isUser = message.actor_kind === "user";
                  const proposal = assistedSuggestionProposal(message);
                  return (
                    <article className={`${styles.message} ${isUser ? styles.userMessage : styles.assistantMessage}`} key={message.id}>
                      <header>{isUser ? <UserRound size={14} /> : <Bot size={14} />}<strong>{isUser ? "Equipe" : message.actor_kind === "lionel" ? "Lionel" : "Pedro"}</strong></header>
                      {message.reply_to_message_id ? <span className={styles.replyMarker}><CornerUpLeft size={12} /> resposta vinculada</span> : null}
                      {proposal ? (
                        <div className={styles.suggestionProposal}>
                          <p>{message.body}</p>
                          {proposal.contextSummary || proposal.analyzedMessage ? (
                            <div className={styles.suggestionContext}>
                              {proposal.contextSummary ? <div className={styles.suggestionContextBlock}>
                                <strong>Contexto resumido</strong>
                                <p>{proposal.contextSummary}</p>
                              </div> : null}
                              {proposal.analyzedMessage ? <blockquote className={styles.analyzedLeadMessage}>
                                <strong>Mensagem do lead analisada</strong>
                                <p>{proposal.analyzedMessage}</p>
                                {proposal.analyzedMessageAt ? <footer>{dateLabel(proposal.analyzedMessageAt)}</footer> : null}
                              </blockquote> : null}
                            </div>
                          ) : null}
                          <div className={styles.suggestionProposalCard}>
                            <div className={styles.suggestionProposalHeader}>
                              <strong>Resposta sugerida ao lead</strong>
                              <span>{proposalStatusLabels[proposal.status] ?? proposal.status}</span>
                            </div>
                            <textarea defaultValue={proposal.body} disabled={proposal.status !== "pending"} maxLength={4096} name="body" readOnly={proposal.status !== "pending"} rows={4} form={`review-${message.id}`} />
                            <div className={styles.suggestionProposalActions}>
                              <Link href={`/app/inbox/${proposal.conversationId}`} prefetch={false}><ExternalLink size={13} /> Ver conversa</Link>
                              {proposal.status === "pending" ? <form action={reviewAiSuggestionFromChatAction} id={`review-${message.id}`}>
                                <input name="threadId" type="hidden" value={activeThread.id} />
                                <input name="suggestionId" type="hidden" value={proposal.suggestionId} />
                                <input name="expectedVersion" type="hidden" value={proposal.expectedVersion} />
                                <button name="action" type="submit" value="send"><Send size={13} /> Aprovar e enviar</button>
                                <button name="action" type="submit" value="teach_only"><Bot size={13} /> Ensinar e gerar outra</button>
                                <button className={styles.discardButton} formNoValidate name="action" type="submit" value="discard">Descartar</button>
                              </form> : null}
                            </div>
                          </div>
                        </div>
                      ) : <p>{message.body}</p>}
                      <footer><time>{dateLabel(message.created_at)}</time><Link href={`${basePath}?topico=${activeThread.id}&responder=${message.id}`} prefetch={false}><CornerUpLeft size={12} /> Responder</Link></footer>
                    </article>
                  );
                })}
                {!messages.length ? <div className={styles.emptyChat}><Bot size={28} /><p>Comece a conversa descrevendo a decisão ou o contexto que precisa ser analisado.</p></div> : null}
              </div>
              <form action={sendInternalMessageAction} className={styles.composer}>
                <input name="threadId" type="hidden" value={activeThread.id} />
                {replyToMessageId ? <input name="replyToMessageId" type="hidden" value={replyToMessageId} /> : null}
                {replyToMessageId ? <p className={styles.replyingTo}><CornerUpLeft size={12} /> Sua resposta ficará vinculada à mensagem selecionada. <Link href={threadHref(basePath, activeThread.id, filters)}>Cancelar</Link></p> : null}
                <textarea maxLength={12000} name="body" placeholder={assistant === "lionel" ? "Responda à pergunta do Lionel ou descreva uma nova regra…" : "Converse com Pedro sobre a operação…"} required rows={3} />
                <div>
                  <span>Escolha o tópico correto na fila; nada é enviado ao lead a partir desta caixa.</span>
                  <button type="submit"><Send size={15} /> Enviar</button>
                </div>
              </form>
              {activeThread.source === "external_device" && activeThread.status !== "resolved" ? <form action={resolveExternalInterventionAction} className={styles.decisionBar}>
                <input name="threadId" type="hidden" value={activeThread.id} />
                <span>Decisão explícita</span>
                <button name="decision" type="submit" value="continue_human">Continuar como humano</button>
                <button name="decision" type="submit" value="return_to_pedro">Devolver ao Pedro</button>
                <button className={styles.dangerDecision} name="decision" type="submit" value="unrecognized">Não reconheço o envio</button>
              </form> : null}
            </>
          ) : (
            <div className={styles.emptyChat}><Bot size={30} /><strong>Selecione um tópico</strong><p>{emptyText}</p></div>
          )}
        </section>

        <aside className={styles.contextRail}>
          <p className={styles.contextLabel}>Como funciona</p>
          <h3>{assistant === "lionel" ? "Curadoria antes da regra" : "Decisão com contexto"}</h3>
          <p>{assistant === "lionel"
            ? "Lionel faz uma pergunta por vez, identifica conflitos e só transforma o consenso em candidato versionado."
            : "Pedro reúne o contexto, propõe o próximo passo e espera confirmação explícita quando houver impacto operacional."}</p>
          <ul>
            <li><CheckCircle2 size={14} /> Histórico preservado</li>
            <li><CheckCircle2 size={14} /> Respostas vinculáveis</li>
            <li><CheckCircle2 size={14} /> Sem envio silencioso ao lead</li>
          </ul>
          {assistant === "lionel" && activeThread ? (
            <form action={createLearningCandidateAction}>
              <input name="threadId" type="hidden" value={activeThread.id} />
              <button className={styles.secondaryAction} type="submit">Registrar candidato</button>
            </form>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
