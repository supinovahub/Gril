import { Bot, Inbox, Pause, UserRound } from "lucide-react";
import Link from "next/link";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import styles from "./inbox.module.css";

export default async function InboxPage() {
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { data: conversations } = await supabase
    .from("conversations")
    .select("id,status,ownership,ai_mode,last_inbound_at,last_message_preview,updated_at,contacts!inner(name),opportunities!inner(id,pipeline_stages!inner(name))")
    .eq("org_id", viewer.organization!.id)
    .order("updated_at", { ascending: false })
    .limit(100);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div><p className={styles.eyebrow}>WhatsApp unificado</p><h1>Inbox</h1><p>Conversas ordenadas pela atividade mais recente e limitadas ao seu acesso.</p></div>
        {viewer.membership?.role !== "broker" ? <Link className={styles.secondaryButton} href="/app/configuracoes/whatsapp">Configurar números</Link> : null}
      </header>

      <section className={styles.inboxPanel}>
        <div className={styles.inboxHeader}><span>{conversations?.length ?? 0} conversas visíveis</span><span>RLS aplicado por operação e janela de acesso</span></div>
        <div className={styles.conversationList}>
          {conversations?.map((conversation) => {
            const contact = Array.isArray(conversation.contacts) ? conversation.contacts[0] : conversation.contacts;
            const opportunity = Array.isArray(conversation.opportunities) ? conversation.opportunities[0] : conversation.opportunities;
            const stage = Array.isArray(opportunity?.pipeline_stages) ? opportunity.pipeline_stages[0] : opportunity?.pipeline_stages;
            return (
              <Link className={styles.conversationRow} href={`/app/inbox/${conversation.id}`} key={conversation.id}>
                <span className={styles.avatar}>{contact?.name?.slice(0, 1).toUpperCase() ?? "?"}</span>
                <span className={styles.conversationCopy}><strong>{contact?.name ?? "Contato"}</strong><small>{conversation.last_message_preview || "Conversa criada sem mensagem"}</small></span>
                <span className={styles.contextBadge}>{stage?.name ?? "Sem etapa"}</span>
                <span className={styles.ownerBadge}>{conversation.status === "paused" ? <Pause size={13} /> : conversation.ownership === "ai" ? <Bot size={13} /> : <UserRound size={13} />}{conversation.status === "paused" ? "Pausada" : conversation.ownership === "ai" ? "Pedro" : "Humano"}</span>
                <time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(conversation.updated_at))}</time>
              </Link>
            );
          })}
          {!conversations?.length ? <div className={styles.empty}><Inbox size={30} /><strong>Nenhuma conversa visível</strong><span>Quando um webhook válido entrar, o contato e a oportunidade serão criados de forma idempotente.</span></div> : null}
        </div>
      </section>
    </div>
  );
}
