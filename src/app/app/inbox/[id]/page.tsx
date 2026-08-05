import { ArrowLeft, Bot, CircleAlert, MessageCircle, Pause, Pencil, Send, UserRoundCheck, X } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { canManageCrm, requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { conversationAction, reviewAiSuggestionAction, sendHumanMessageAction } from "../actions";
import { updateContactNameAction } from "../../contact-actions";
import styles from "../inbox.module.css";
import { ConversationReadMarker } from "./conversation-read-marker";
import { startBrokerConsultationAction } from "../../chat-interno/actions";

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

export default async function ConversationPage({
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
  const [conversationResult, messagesResult, summaryResult, suggestionsResult, executionsResult, settingsResult] = await Promise.all([
    supabase.from("conversations").select("*,contacts!inner(id,name,contact_phones(e164,is_primary,status)),opportunities!conversations_opportunity_id_org_id_fkey(id,pipeline_stages!inner(name)),whatsapp_connections!inner(name,provider)").eq("id", id).maybeSingle(),
    supabase.from("messages").select("*").eq("conversation_id", id).order("created_at").limit(300),
    supabase.from("conversation_summaries").select("summary,facts,created_at").eq("conversation_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("ai_suggestions").select("id,body,status,created_at").eq("conversation_id", id).eq("status", "pending").order("created_at", { ascending: false }),
    supabase.from("ai_executions").select("id,request_message_id,status,error_code,created_at").eq("conversation_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("organization_settings").select("ai_global_mode").eq("org_id", viewer.organization!.id).maybeSingle(),
  ]);
  const queryError = conversationResult.error ?? messagesResult.error ?? summaryResult.error ?? suggestionsResult.error ?? executionsResult.error ?? settingsResult.error;
  if (queryError) {
    console.error("Failed to load Inbox conversation", queryError);
    throw new Error("Não foi possível carregar a conversa do Inbox.");
  }

  const conversation = conversationResult.data;
  const messages = messagesResult.data;
  const summary = summaryResult.data;
  const suggestions = suggestionsResult.data;
  const latestExecution = executionsResult.data;
  const globalAiMode = settingsResult.data?.ai_global_mode ?? "off";
  if (!conversation) notFound();

  const latestInbound = [...(messages ?? [])].reverse().find((message) => message.direction === "inbound");
  const currentExecution = latestExecution?.request_message_id === latestInbound?.id ? latestExecution : null;

  const contact = Array.isArray(conversation.contacts) ? conversation.contacts[0] : conversation.contacts;
  const opportunity = Array.isArray(conversation.opportunities) ? conversation.opportunities[0] : conversation.opportunities;
  const stage = Array.isArray(opportunity?.pipeline_stages) ? opportunity.pipeline_stages[0] : opportunity?.pipeline_stages;
  const connection = Array.isArray(conversation.whatsapp_connections) ? conversation.whatsapp_connections[0] : conversation.whatsapp_connections;
  const phones = (contact?.contact_phones ?? []) as Array<{ e164: string; is_primary: boolean; status: string }>;
  const canEditContact = canManageCrm(viewer);
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

  return (
    <div className={styles.page}>
      <ConversationReadMarker conversationId={conversation.id} />
      <Link className={styles.backLink} href="/app/inbox"><ArrowLeft size={15} /> Voltar para Inbox</Link>
      <header className={styles.chatHeader}>
        <div className={styles.chatHeaderIdentity}><span className={styles.avatar}>{contact?.name?.slice(0, 1).toUpperCase()}</span><div><div className={styles.contactNameRow}><h1>{contact?.name}</h1>{canEditContact ? <details className={styles.contactNameEditor}><summary aria-label="Editar nome do contato" title="Editar nome do contato"><Pencil size={14} /></summary><form action={updateContactNameAction} className={styles.contactNameForm}><input name="contactId" type="hidden" value={contact?.id ?? ""} /><input name="context" type="hidden" value="inbox" /><input name="contextId" type="hidden" value={conversation.id} /><label><span>Nome do contato</span><input defaultValue={contact?.name ?? ""} maxLength={160} minLength={2} name="name" required /></label><button type="submit">Salvar nome</button></form></details> : null}</div><p>{phones.find((phone) => phone.is_primary && phone.status === "active")?.e164 ?? "Telefone protegido"} · {stage?.name}</p></div></div>
        <span className={styles.contextBadge}>{connection?.name} · {connection?.provider}</span>
      </header>
      {feedback.erro ? <p className={styles.errorBanner}>{feedback.erro}</p> : null}
      {feedback.sucesso ? <p className={styles.successBanner}>{successText}</p> : null}

      <div className={styles.chatLayout}>
        <section className={styles.chatPanel}>
          {suggestions?.length ? <div className={styles.suggestionStack}>
            {suggestions.map((suggestion) => <form action={reviewAiSuggestionAction} className={styles.suggestionCard} key={suggestion.id}>
              <input name="suggestionId" type="hidden" value={suggestion.id} /><input name="conversationId" type="hidden" value={conversation.id} /><input name="expectedVersion" type="hidden" value={conversation.version} />
              <header><span><Bot size={15} /> Sugestão do Pedro</span><small>{new Date(suggestion.created_at).toLocaleString("pt-BR")}</small></header>
              <textarea defaultValue={suggestion.body} maxLength={4096} name="body" required rows={4} />
              <footer><button name="action" type="submit" value="send"><Send size={14} /> Aprovar e enviar</button><button className={styles.teachButton} name="action" type="submit" value="teach_only"><Bot size={14} /> Ensinar e gerar outra</button><button className={styles.discardButton} formNoValidate name="action" type="submit" value="discard"><X size={14} /> Só descartar</button></footer>
            </form>)}
          </div> : null}
          <div className={styles.messages}>
            {messages?.map((message) => (
              <article className={`${message.direction === "inbound" ? styles.inbound : styles.outbound} ${message.provider_status === "failed" || message.provider_status === "suppressed" ? styles.notSent : ""}`} key={message.id}>
                <p>{message.body || `[${message.content_type}]`}</p>
                <footer><span>{senderLabel(message.sender_type, message.metadata)}</span><time>{new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", dateStyle: "short" }).format(new Date(message.created_at))}</time><span>{message.provider_status === "suppressed" ? "não enviada" : message.provider_status === "failed" ? "falha no envio" : message.provider_status}</span></footer>
              </article>
            ))}
            {!messages?.length ? <div className={styles.empty}><MessageCircle size={26} /><span>Sem mensagens.</span></div> : null}
          </div>
          <form action={sendHumanMessageAction} className={styles.composer}>
            <input name="conversationId" type="hidden" value={conversation.id} />
            <input name="expectedVersion" type="hidden" value={conversation.version} />
            <textarea disabled={conversation.status !== "active"} maxLength={4096} name="body" placeholder={conversation.status === "active" ? "Escreva uma resposta humana…" : "Conversa pausada ou encerrada"} required rows={3} />
            <button disabled={conversation.status !== "active"} type="submit"><Send size={16} /> Enfileirar</button>
          </form>
        </section>

        <aside className={styles.contextPanel}>
          <section><h2>Controle</h2><p>Versão {conversation.version} · {conversation.status} · {conversation.ownership}{currentExecution ? ` · IA ${currentExecution.status}` : " · última mensagem ainda sem execução"}</p><div className={styles.controlGrid}>
            <form action={conversationAction}><input name="conversationId" type="hidden" value={conversation.id} /><input name="expectedVersion" type="hidden" value={conversation.version} /><button name="action" type="submit" value="take_over"><UserRoundCheck size={14} /> Assumir</button></form>
            <form action={conversationAction}><input name="conversationId" type="hidden" value={conversation.id} /><input name="expectedVersion" type="hidden" value={conversation.version} /><input name="reason" type="hidden" value="Reprocessamento manual solicitado no Inbox" /><button disabled={globalAiMode === "off" || conversation.status === "closed"} name="action" type="submit" value="return_to_ai"><Bot size={14} /> {globalAiMode === "off" ? "Pedro desativado" : conversation.ownership === "ai" ? "Reprocessar com Pedro" : "Devolver ao Pedro e processar"}</button></form>
            <form action={conversationAction}><input name="conversationId" type="hidden" value={conversation.id} /><input name="expectedVersion" type="hidden" value={conversation.version} /><button name="action" type="submit" value="pause"><Pause size={14} /> Pausar</button></form>
            <form action={conversationAction}><input name="conversationId" type="hidden" value={conversation.id} /><input name="expectedVersion" type="hidden" value={conversation.version} /><button name="action" type="submit" value="close"><X size={14} /> Encerrar</button></form>
          </div></section>
          <section><h2>Resumo</h2><p>{summary?.summary || "O resumo versionado será gerado pelo motor Pedro quando houver contexto suficiente."}</p></section>
          <section><h2>Proteções</h2><p><CircleAlert size={14} /> Opt-out, supressão e versão da conversa são revalidados no banco antes de qualquer envio.</p></section>
          <Link className={styles.secondaryButton} href={`/app/leads/${opportunity?.id}`}>Abrir oportunidade</Link>
          {viewer.membership?.role === "broker" ? <form action={startBrokerConsultationAction}><input name="conversationId" type="hidden" value={conversation.id} /><button className={styles.secondaryButton} type="submit"><Bot size={14} /> Pedir ajuda ao Pedro</button></form> : null}
        </aside>
      </div>
    </div>
  );
}

