import { BrainCircuit, Send } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { sendPlatformLionelMessageAction } from "./actions";
import styles from "./platform-lionel.module.css";

export default async function PlatformLionelPage() {
  const viewer = await requireViewer();
  if (viewer.platformRole !== "platform_admin") redirect("/platform");
  const supabase = await createClient();
  let { data: thread } = await supabase.from("platform_internal_threads").select("*").eq("thread_type", "general").neq("status", "archived").order("created_at").limit(1).maybeSingle();
  if (!thread) {
    const created = await supabase.from("platform_internal_threads").insert({ title: "Curadoria geral da plataforma", thread_type: "general", created_by: viewer.userId }).select("*").single();
    thread = created.data;
  }
  const { data: messages } = thread ? await supabase.from("platform_internal_messages").select("*").eq("thread_id", thread.id).order("created_at").limit(300) : { data: [] };
  return <main className={styles.page}>
    <header><div><p>Governança da plataforma</p><h1>Lionel</h1><span>Curadoria do pacote-base, incidentes recorrentes e prompts técnicos sem conteúdo de imobiliárias.</span></div><Link href="/platform">Voltar ao controle geral</Link></header>
    <section className={styles.chat}>
      <div className={styles.messages}>{messages?.map((message) => <article data-user={message.actor_kind === "user"} key={message.id}><strong>{message.actor_kind === "user" ? "Admin" : "Lionel"}</strong><p>{message.body}</p><time>{new Date(message.created_at).toLocaleString("pt-BR")}</time></article>)}{!messages?.length ? <div className={styles.empty}><BrainCircuit size={30} />Descreva uma mudança do pacote-base ou um incidente recorrente.</div> : null}</div>
      {thread ? <form action={sendPlatformLionelMessageAction}><input name="threadId" type="hidden" value={thread.id} /><textarea name="body" placeholder="Converse com Lionel sobre a plataforma…" required rows={4}/><button><Send size={15}/>Enviar</button></form> : null}
    </section>
  </main>;
}
