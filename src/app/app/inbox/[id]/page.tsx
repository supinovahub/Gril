import { ArrowLeft, Bot, CircleAlert, MessageCircle, Pause, Send, UserRoundCheck, X } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { conversationAction, reviewAiSuggestionAction, sendHumanMessageAction } from "../actions";
import styles from "../inbox.module.css";

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  await requireActiveViewer();
  const { id } = await params;
  const feedback = await searchParams;
  const supabase = await createClient();
  const [{ data: conversation }, { data: messages }, { data: summary }, { data: suggestions }] = await Promise.all([
    supabase.from("conversations").select("*,contacts!inner(name,contact_phones(e164,is_primary,status)),opportunities!inner(id,pipeline_stages!inner(name)),whatsapp_connections!inner(name,provider)").eq("id", id).maybeSingle(),
    supabase.from("messages").select("*").eq("conversation_id", id).order("created_at").limit(300),
    supabase.from("conversation_summaries").select("summary,facts,created_at").eq("conversation_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("ai_suggestions").select("id,body,status,created_at").eq("conversation_id", id).eq("status", "pending").order("created_at", { ascending: false }),
  ]);
  if (!conversation) notFound();

  const contact = Array.isArray(conversation.contacts) ? conversation.contacts[0] : conversation.contacts;
  const opportunity = Array.isArray(conversation.opportunities) ? conversation.opportunities[0] : conversation.opportunities;
  const stage = Array.isArray(opportunity?.pipeline_stages) ? opportunity.pipeline_stages[0] : opportunity?.pipeline_stages;
  const connection = Array.isArray(conversation.whatsapp_connections) ? conversation.whatsapp_connections[0] : conversation.whatsapp_connections;
  const phones = (contact?.contact_phones ?? []) as Array<{ e164: string; is_primary: boolean; status: string }>;

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} href="/app/inbox"><ArrowLeft size={15} /> Voltar para Inbox</Link>
      <header className={styles.chatHeader}>
        <div><span className={styles.avatar}>{contact?.name?.slice(0, 1).toUpperCase()}</span><span><h1>{contact?.name}</h1><p>{phones.find((phone) => phone.is_primary && phone.status === "active")?.e164 ?? "Telefone protegido"} · {stage?.name}</p></span></div>
        <span className={styles.contextBadge}>{connection?.name} · {connection?.provider}</span>
      </header>
      {feedback.erro ? <p className={styles.errorBanner}>{feedback.erro}</p> : null}
      {feedback.sucesso ? <p className={styles.successBanner}>Mensagem registrada e enfileirada para envio.</p> : null}

      <div className={styles.chatLayout}>
        <section className={styles.chatPanel}>
          {suggestions?.length ? <div className={styles.suggestionStack}>
            {suggestions.map((suggestion) => <form action={reviewAiSuggestionAction} className={styles.suggestionCard} key={suggestion.id}>
              <input name="suggestionId" type="hidden" value={suggestion.id} /><input name="conversationId" type="hidden" value={conversation.id} /><input name="expectedVersion" type="hidden" value={conversation.version} />
              <header><span><Bot size={15} /> Sugestão do Pedro</span><small>{new Date(suggestion.created_at).toLocaleString("pt-BR")}</small></header>
              <textarea defaultValue={suggestion.body} maxLength={4096} name="body" required rows={4} />
              <footer><button name="action" type="submit" value="send"><Send size={14} /> Aprovar e enviar</button><button className={styles.discardButton} formNoValidate name="action" type="submit" value="discard"><X size={14} /> Descartar</button></footer>
            </form>)}
          </div> : null}
          <div className={styles.messages}>
            {messages?.map((message) => (
              <article className={message.direction === "inbound" ? styles.inbound : styles.outbound} key={message.id}>
                <p>{message.body || `[${message.content_type}]`}</p>
                <footer><span>{message.sender_type}</span><time>{new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", dateStyle: "short" }).format(new Date(message.created_at))}</time><span>{message.provider_status}</span></footer>
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
          <section><h2>Controle</h2><p>Versão {conversation.version} · {conversation.status} · {conversation.ownership}</p><div className={styles.controlGrid}>
            <form action={conversationAction}><input name="conversationId" type="hidden" value={conversation.id} /><input name="expectedVersion" type="hidden" value={conversation.version} /><button name="action" type="submit" value="take_over"><UserRoundCheck size={14} /> Assumir</button></form>
            <form action={conversationAction}><input name="conversationId" type="hidden" value={conversation.id} /><input name="expectedVersion" type="hidden" value={conversation.version} /><button name="action" type="submit" value="return_to_ai"><Bot size={14} /> Devolver</button></form>
            <form action={conversationAction}><input name="conversationId" type="hidden" value={conversation.id} /><input name="expectedVersion" type="hidden" value={conversation.version} /><button name="action" type="submit" value="pause"><Pause size={14} /> Pausar</button></form>
            <form action={conversationAction}><input name="conversationId" type="hidden" value={conversation.id} /><input name="expectedVersion" type="hidden" value={conversation.version} /><button name="action" type="submit" value="close"><X size={14} /> Encerrar</button></form>
          </div></section>
          <section><h2>Resumo</h2><p>{summary?.summary || "O resumo versionado será gerado pelo motor Pedro quando houver contexto suficiente."}</p></section>
          <section><h2>Proteções</h2><p><CircleAlert size={14} /> Opt-out, supressão e versão da conversa são revalidados no banco antes de qualquer envio.</p></section>
          <Link className={styles.secondaryButton} href={`/app/leads/${opportunity?.id}`}>Abrir oportunidade</Link>
        </aside>
      </div>
    </div>
  );
}

