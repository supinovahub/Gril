import {
  ArrowLeft,
  Bot,
  Check,
  CircleAlert,
  History,
  MoreHorizontal,
  Pencil,
  Phone,
  Pause,
  Send,
  UserRoundCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { canManageCrm, requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatOperationDateTime } from "@/lib/time/operation-format";
import {
  completeNextActionAction,
  recordQualificationAction,
} from "../../leads/actions";
import { updateContactNameAction } from "../../contact-actions";
import {
  conversationAction,
  reviewAiSuggestionAction,
  sendHumanMessageAction,
} from "../actions";
import styles from "../inbox.module.css";
import { startBrokerConsultationAction } from "../../chat-interno/actions";
import { ConversationViews } from "../conversation-views";
import { ConversationReadMarker } from "./conversation-read-marker";

type ConversationTab = "messages" | "overview" | "qualification" | "summary" | "next-actions" | "history";

const tabs: Array<{ id: ConversationTab; label: string }> = [
  { id: "messages", label: "Mensagens" },
  { id: "overview", label: "Visão geral" },
  { id: "qualification", label: "Qualificação" },
  { id: "summary", label: "Resumo" },
  { id: "next-actions", label: "Próximas ações" },
  { id: "history", label: "Histórico" },
];

function senderLabel(senderType: string, metadata: unknown) {
  const source = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>).source
    : null;
  if (source === "whatsapp_device") return "enviada pelo celular";
  if (senderType === "system") return "automação";
  if (senderType === "ai") return "Pedro";
  if (senderType === "contact") return "lead";
  return "equipe";
}

function qualificationStatusLabel(current: { human_confirmed?: boolean; state?: string } | undefined) {
  if (!current) return "Ainda não preenchido";
  if (current.human_confirmed) return "Confirmado pela equipe";
  if (current.state === "refused") return "Lead não informou";
  return "Recebido na conversa";
}

function formatQualificationValue(
  current: { value_number?: number | null; value_text?: string | null; state?: string } | undefined,
  answerType: string,
) {
  if (current?.value_number !== null && current?.value_number !== undefined) {
    return new Intl.NumberFormat("pt-BR", {
      style: answerType === "money" ? "currency" : "decimal",
      currency: "BRL",
    }).format(current.value_number);
  }
  return current?.value_text ?? (current?.state === "refused" ? "Não informado" : "Pendente");
}

function stringFacts(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function normalizeTab(value: string | undefined): ConversationTab {
  return tabs.some((tab) => tab.id === value) ? (value as ConversationTab) : "messages";
}

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; sucesso?: string; tab?: string }>;
}) {
  const viewer = await requireActiveViewer();
  const { id } = await params;
  const feedback = await searchParams;
  const activeTab = normalizeTab(feedback.tab);
  const supabase = await createClient();

  const [conversationResult, messagesResult, summaryResult, suggestionsResult, settingsResult] = await Promise.all([
    supabase
      .from("conversations")
      .select("*,contacts!inner(id,name,contact_phones(e164,is_primary,status)),opportunities!conversations_opportunity_id_org_id_fkey(id,pipeline_stages!inner(name)),whatsapp_connections!inner(name,provider)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("messages").select("*").eq("conversation_id", id).order("created_at").limit(300),
    supabase.from("conversation_summaries").select("summary,facts,created_at").eq("conversation_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("ai_suggestions").select("id,body,status,created_at").eq("conversation_id", id).eq("status", "pending").order("created_at", { ascending: false }),
    supabase.from("organization_settings").select("ai_global_mode").eq("org_id", viewer.organization!.id).maybeSingle(),
  ]);

  const conversation = conversationResult.data;
  if (!conversation) notFound();

  const opportunityRelation = Array.isArray(conversation.opportunities) ? conversation.opportunities[0] : conversation.opportunities;
  const opportunityId = opportunityRelation?.id;
  const detailResults = opportunityId
    ? await Promise.all([
        supabase.from("opportunities").select("*,contacts!inner(id,name,status,contact_phones(*)),pipeline_stages!inner(id,name,code,position)").eq("id", opportunityId).maybeSingle(),
        supabase.from("qualification_definitions").select("*").eq("org_id", viewer.organization!.id).eq("active", true).order("suggested_order"),
        supabase.from("qualification_values").select("*").eq("opportunity_id", opportunityId),
        supabase.from("next_actions").select("*").eq("opportunity_id", opportunityId).order("due_at"),
        supabase.from("opportunity_stage_history").select("*, from:pipeline_stages!opportunity_stage_history_from_stage_id_org_id_fkey(name), to:pipeline_stages!opportunity_stage_history_to_stage_id_org_id_fkey(name)").eq("opportunity_id", opportunityId).order("created_at", { ascending: false }),
        supabase.from("opportunity_scores").select("score,explanation,created_at").eq("opportunity_id", opportunityId).order("created_at", { ascending: false }).limit(1),
      ])
    : null;

  const queryError = conversationResult.error
    ?? messagesResult.error
    ?? summaryResult.error
    ?? suggestionsResult.error
    ?? settingsResult.error
    ?? detailResults?.find((result) => result.error)?.error;
  if (queryError) {
    console.error("Failed to load Inbox conversation", queryError);
    throw new Error("Não foi possível carregar a conversa do Inbox.");
  }

  const messages = messagesResult.data ?? [];
  const suggestions = suggestionsResult.data ?? [];
  const summary = summaryResult.data;
  const globalAiMode = settingsResult.data?.ai_global_mode ?? "off";
  const opportunity = detailResults?.[0].data;
  const qualificationDefinitions = detailResults?.[1].data ?? [];
  const qualificationValues = detailResults?.[2].data ?? [];
  const nextActions = detailResults?.[3].data ?? [];
  const stageHistory = detailResults?.[4].data ?? [];
  const latestScore = detailResults?.[5].data?.[0];

  const operationTimezone = viewer.operations.find((operation) => operation.id === conversation.operation_id)?.timezone;
  const contact = Array.isArray(conversation.contacts) ? conversation.contacts[0] : conversation.contacts;
  const stage = Array.isArray(opportunity?.pipeline_stages) ? opportunity.pipeline_stages[0] : opportunity?.pipeline_stages;
  const connection = Array.isArray(conversation.whatsapp_connections) ? conversation.whatsapp_connections[0] : conversation.whatsapp_connections;
  const phones = (contact?.contact_phones ?? []) as Array<{ e164: string; is_primary: boolean; status: string }>;
  const canEditContact = canManageCrm(viewer);
  const scoreExplanation = latestScore?.explanation as { band?: string; missing?: string[] } | null | undefined;
  const bandLabel: Record<string, string> = { high: "Alta", normal: "Normal", followup: "Follow-up", outside_profile: "Fora do perfil" };
  const successText = feedback.sucesso === "pedro-reprocessado"
    ? "Pedro recebeu a última mensagem novamente. O modo configurado definirá se ele cria uma sugestão ou responde automaticamente."
    : feedback.sucesso === "sugestao-discard"
      ? "Sugestão descartada. Nenhuma mensagem foi enviada."
      : feedback.sucesso === "sugestao-teach_only"
        ? "Ensinamento registrado. Nada foi enviado ao lead e Pedro está gerando uma nova sugestão."
        : feedback.sucesso === "sugestao-send"
          ? "Sugestão aprovada e enfileirada para envio."
          : feedback.sucesso === "nome-atualizado"
            ? "Nome do contato atualizado."
            : "Mensagem registrada e enfileirada para envio.";

  const timeline = [
    ...messages.map((message) => ({ kind: "message" as const, createdAt: message.created_at, message })),
    ...suggestions.map((suggestion) => ({ kind: "suggestion" as const, createdAt: suggestion.created_at, suggestion })),
  ].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());

  const tabHref = (tab: ConversationTab) => `/app/inbox/${conversation.id}?tab=${tab}`;

  return (
    <div className={styles.page}>
      <ConversationReadMarker conversationId={conversation.id} />
      <ConversationViews active="conversations" />
      <Link className={styles.backLink} href="/app/inbox"><ArrowLeft size={15} /> Voltar para conversas</Link>

      <header className={styles.chatHeader}>
        <div className={styles.chatHeaderIdentity}>
          <span className={styles.avatar}>{contact?.name?.slice(0, 1).toUpperCase()}</span>
          <div>
            <div className={styles.contactNameRow}>
              <h1>{contact?.name}</h1>
              {canEditContact ? <details className={styles.contactNameEditor}>
                <summary aria-label="Editar nome do contato" title="Editar nome do contato"><Pencil size={14} /></summary>
                <form action={updateContactNameAction} className={styles.contactNameForm}>
                  <input name="contactId" type="hidden" value={contact?.id ?? ""} />
                  <input name="context" type="hidden" value="inbox" />
                  <input name="contextId" type="hidden" value={conversation.id} />
                  <label><span>Nome do contato</span><input defaultValue={contact?.name ?? ""} maxLength={160} minLength={2} name="name" required /></label>
                  <button type="submit">Salvar nome</button>
                </form>
              </details> : null}
            </div>
            <p>{phones.find((phone) => phone.is_primary && phone.status === "active")?.e164 ?? "Telefone protegido"} · {stage?.name ?? "Sem etapa"}</p>
          </div>
        </div>
        <div className={styles.chatHeaderActions}>
          <span className={styles.contextBadge}>{connection?.name} · {connection?.provider}</span>
          <details className={styles.conversationControls}>
            <summary aria-label="Abrir ações da conversa" title="Ações da conversa"><MoreHorizontal size={18} /></summary>
            <div className={styles.controlsMenu}>
              <form action={conversationAction}><input name="conversationId" type="hidden" value={conversation.id} /><input name="expectedVersion" type="hidden" value={conversation.version} /><button name="action" type="submit" value="take_over"><UserRoundCheck size={14} /> Assumir atendimento</button></form>
              <form action={conversationAction}><input name="conversationId" type="hidden" value={conversation.id} /><input name="expectedVersion" type="hidden" value={conversation.version} /><input name="reason" type="hidden" value="Reprocessamento manual solicitado no Inbox" /><button disabled={globalAiMode === "off" || conversation.status === "closed"} name="action" type="submit" value="return_to_ai"><Bot size={14} /> {globalAiMode === "off" ? "Pedro desativado" : "Reprocessar com Pedro"}</button></form>
              <form action={conversationAction}><input name="conversationId" type="hidden" value={conversation.id} /><input name="expectedVersion" type="hidden" value={conversation.version} /><button name="action" type="submit" value="pause"><Pause size={14} /> Pausar atendimento</button></form>
              <form action={conversationAction}><input name="conversationId" type="hidden" value={conversation.id} /><input name="expectedVersion" type="hidden" value={conversation.version} /><button name="action" type="submit" value="close"><X size={14} /> Encerrar conversa</button></form>
              {viewer.membership?.role === "broker" ? <form action={startBrokerConsultationAction}><input name="conversationId" type="hidden" value={conversation.id} /><button type="submit"><Bot size={14} /> Pedir ajuda ao Pedro</button></form> : null}
            </div>
          </details>
        </div>
      </header>

      {feedback.erro ? <p className={styles.errorBanner}>{feedback.erro}</p> : null}
      {feedback.sucesso ? <p className={styles.successBanner}>{successText}</p> : null}

      <nav aria-label="Contexto do lead" className={styles.detailTabs}>
        {tabs.map((tab) => <Link aria-current={activeTab === tab.id ? "page" : undefined} className={activeTab === tab.id ? styles.detailTabActive : styles.detailTab} href={tabHref(tab.id)} key={tab.id} prefetch={false}>{tab.label}</Link>)}
      </nav>

      {activeTab === "messages" ? (
        <section className={styles.chatPanel}>
          <div className={styles.messages}>
            {timeline.map((item) => item.kind === "suggestion" ? (
              <form action={reviewAiSuggestionAction} className={`${styles.message} ${styles.suggestionMessage}`} key={item.suggestion.id}>
                <input name="suggestionId" type="hidden" value={item.suggestion.id} />
                <input name="conversationId" type="hidden" value={conversation.id} />
                <input name="expectedVersion" type="hidden" value={conversation.version} />
                <header className={styles.suggestionHeader}><span><Bot size={14} /> Sugestão do Pedro</span><small>Aguardando aprovação · {formatOperationDateTime(item.suggestion.created_at, operationTimezone)}</small></header>
                <textarea defaultValue={item.suggestion.body} maxLength={4096} name="body" required rows={4} aria-label="Mensagem sugerida pelo Pedro" />
                <footer className={styles.suggestionActions}>
                  <button className={styles.discardButton} formNoValidate name="action" type="submit" value="discard"><X size={13} /> Declinar</button>
                  <button className={styles.teachButton} name="action" type="submit" value="teach_only"><Bot size={13} /> Gerar outra</button>
                  <button className={styles.approveButton} name="action" type="submit" value="send"><Send size={13} /> Aprovar e enviar</button>
                </footer>
              </form>
            ) : (
              <article className={`${styles.message} ${item.message.direction === "inbound" ? styles.inbound : styles.outbound} ${item.message.provider_status === "failed" || item.message.provider_status === "suppressed" ? styles.notSent : ""}`} key={item.message.id}>
                <p>{item.message.body || `[${item.message.content_type}]`}</p>
                <footer><span>{senderLabel(item.message.sender_type, item.message.metadata)}</span><time>{formatOperationDateTime(item.message.created_at, operationTimezone)}</time><span>{item.message.provider_status === "suppressed" ? "não enviada" : item.message.provider_status === "failed" ? "falha no envio" : item.message.provider_status}</span></footer>
              </article>
            ))}
            {!timeline.length ? <div className={styles.empty}><Phone size={26} /><span>Sem mensagens.</span></div> : null}
          </div>
          <form action={sendHumanMessageAction} className={styles.composer}>
            <input name="conversationId" type="hidden" value={conversation.id} />
            <input name="expectedVersion" type="hidden" value={conversation.version} />
            <textarea disabled={conversation.status !== "active"} maxLength={4096} name="body" placeholder={conversation.status === "active" ? "Escreva uma resposta humana…" : "Conversa pausada ou encerrada"} required rows={3} />
            <button disabled={conversation.status !== "active"} type="submit"><Send size={16} /> Enviar resposta humana</button>
            <p className={styles.composerHelp}>A mensagem entra na fila da conta conectada e aparece no histórico depois do envio.</p>
          </form>
          <p className={styles.protectionNote}><CircleAlert size={14} /> Opt-out, bloqueios e a versão mais recente da conversa são verificados antes do envio.</p>
        </section>
      ) : (
        <section className={styles.leadTabPanel}>
          {activeTab === "overview" ? <>
            <header className={styles.tabIntro}><p className={styles.eyebrow}>Contexto do lead</p><h2>Visão geral</h2><p>Os sinais comerciais e o contexto que ajudam a decidir o próximo movimento.</p></header>
            <dl className={styles.factGrid}>
              <div><dt>WhatsApp</dt><dd><Phone size={14} /> {phones.find((phone) => phone.is_primary)?.e164 ?? "Não informado"}</dd></div>
              <div><dt>Etapa atual</dt><dd>{stage?.position}. {stage?.name ?? "Sem etapa"}</dd></div>
              <div><dt>Origem</dt><dd>{opportunity?.source ?? "Não informada"}</dd></div>
              <div><dt>Prioridade comercial</dt><dd>{latestScore ? `${bandLabel[scoreExplanation?.band ?? ""] ?? scoreExplanation?.band ?? "Em cálculo"} · ${latestScore.score}/100` : "Ainda sem sinais"}</dd></div>
              <div><dt>Estrutura da compra</dt><dd>{opportunity?.unit_quantity ?? 1} unidade(s) · valores {opportunity?.amount_scope === "per_unit" ? "por unidade" : "totais"}</dd></div>
              <div><dt>Informações que faltam</dt><dd>{scoreExplanation?.missing?.length ? scoreExplanation.missing.join(", ") : "Nenhum dado mínimo pendente"}</dd></div>
              <div><dt>Contexto para Pedro</dt><dd>{opportunity?.ai_context || "Não informado"}</dd></div>
              <div><dt>Nota interna</dt><dd>{opportunity?.internal_note || "Não informada"}</dd></div>
            </dl>
            <div className={styles.tabActions}><Link className={styles.secondaryButton} href={`/app/leads/${opportunity?.id}`} prefetch={false}>Abrir oportunidade completa</Link></div>
          </> : null}

          {activeTab === "qualification" ? <>
            <header className={styles.tabIntro}><p className={styles.eyebrow}>Dados de compra</p><h2>Qualificação</h2><p>Preencha o que o lead já informou. O restante pode ser coletado pelo Pedro ou pela equipe.</p></header>
            <div className={styles.qualificationList}>
              {qualificationDefinitions.map((definition) => {
                const current = qualificationValues.find((value) => value.definition_id === definition.id);
                const display = formatQualificationValue(current ?? undefined, definition.answer_type);
                return <form action={recordQualificationAction} className={styles.qualificationRow} key={definition.id}>
                  <input name="opportunityId" type="hidden" value={opportunity?.id ?? ""} />
                  <input name="definitionId" type="hidden" value={definition.id} />
                  <input name="answerType" type="hidden" value={definition.answer_type} />
                  {current ? <input name="expectedVersion" type="hidden" value={current.version} /> : null}
                  <span><strong>{definition.name}</strong><small>{qualificationStatusLabel(current ?? undefined)}</small></span>
                  <input defaultValue={display === "Pendente" ? "" : display} name="value" placeholder={display === "Pendente" ? "Informe um valor" : display} required />
                  <button type="submit">Salvar</button>
                </form>;
              })}
              {!qualificationDefinitions.length ? <p className={styles.mutedCopy}>Nenhum campo de qualificação ativo.</p> : null}
            </div>
          </> : null}

          {activeTab === "summary" ? <>
            <header className={styles.tabIntro}><p className={styles.eyebrow}>Leitura rápida</p><h2>Resumo da conversa</h2><p>Contexto acumulado para a equipe retomar o atendimento sem reler tudo.</p></header>
            <div className={styles.summaryBlock}><p>{summary?.summary || "Ainda não há contexto suficiente para gerar um resumo."}</p></div>
            {stringFacts(summary?.facts).length ? <div className={styles.factList}>{stringFacts(summary?.facts).map((fact) => <div key={fact}><span />{fact}</div>)}</div> : null}
          </> : null}

          {activeTab === "next-actions" ? <>
            <header className={styles.tabIntro}><p className={styles.eyebrow}>Ritmo de atendimento</p><h2>Próximas ações</h2><p>O que precisa acontecer para a oportunidade avançar.</p></header>
            <div className={styles.actionList}>
              {nextActions.map((action) => <div className={styles.actionRow} key={action.id}>
                <span><strong>{action.description}</strong><small>{formatOperationDateTime(action.due_at, operationTimezone, { dateStyle: "medium", timeStyle: "short" })}</small></span>
                {action.status === "open" ? <form action={completeNextActionAction}><input name="actionId" type="hidden" value={action.id} /><input name="opportunityId" type="hidden" value={opportunity?.id ?? ""} /><button className={styles.iconAction} title="Concluir ação" type="submit"><Check size={16} /></button></form> : <span className={styles.doneLabel}>{action.status}</span>}
              </div>)}
              {!nextActions.length ? <p className={styles.mutedCopy}>Nenhuma próxima ação registrada.</p> : null}
            </div>
          </> : null}

          {activeTab === "history" ? <>
            <header className={styles.tabIntro}><p className={styles.eyebrow}>Linha do tempo</p><h2>Histórico de etapa</h2><p>Mudanças registradas na jornada dessa oportunidade.</p></header>
            <ol className={styles.timeline}>
              {stageHistory.map((item) => {
                const from = Array.isArray(item.from) ? item.from[0] : item.from;
                const to = Array.isArray(item.to) ? item.to[0] : item.to;
                return <li key={item.id}><span className={styles.timelineDot} /><div><strong>{from?.name ? `${from.name} → ` : ""}{to?.name}</strong><small>{item.reason || "Mudança registrada"} · v{item.opportunity_version}</small></div><time>{formatOperationDateTime(item.created_at, operationTimezone)}</time></li>;
              })}
              {!stageHistory.length ? <li className={styles.mutedCopy}><History size={15} /> Nenhuma mudança de etapa registrada.</li> : null}
            </ol>
          </> : null}
        </section>
      )}
    </div>
  );
}
