import { CalendarCheck2 } from "lucide-react";
import Link from "next/link";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import styles from "../operations.module.css";

export default async function TodayPage() {
  const viewer = await requireActiveViewer(); const supabase = await createClient(); const memberId = viewer.membership!.id;
  const start = new Date(); start.setHours(0,0,0,0); const end = new Date(start); end.setDate(end.getDate()+1);
  const [{ data: actions }, { data: calls }, { data: conversations }] = await Promise.all([
    supabase.from("next_actions").select("id,opportunity_id,description,due_at,status").eq("owner_membership_id", memberId).eq("status", "open").lt("due_at", end.toISOString()).order("due_at"),
    supabase.from("calls").select("id,opportunity_id,starts_at,format,status").eq("assigned_membership_id", memberId).gte("starts_at", start.toISOString()).lt("starts_at", end.toISOString()).order("starts_at"),
    supabase.from("conversations").select("id,last_message_preview,last_inbound_at,opportunity_id").eq("assigned_membership_id", memberId).eq("status", "active").order("last_inbound_at", { ascending: false }).limit(20),
  ]);
  return <div className={styles.page}><header className={styles.header}><div><p className={styles.eyebrow}>Corretor</p><h1>Hoje</h1><p>Calls, próximas ações e conversas que exigem atenção no seu escopo.</p></div><CalendarCheck2/></header>
    <section className={styles.metrics}><div className={styles.metric}><small>Calls</small><strong>{calls?.length ?? 0}</strong><span>hoje</span></div><div className={styles.metric}><small>Ações</small><strong>{actions?.length ?? 0}</strong><span>abertas ou vencidas</span></div><div className={styles.metric}><small>Conversas</small><strong>{conversations?.length ?? 0}</strong><span>ativas</span></div></section>
    <div className={styles.layout}><main><section className={styles.panel}><div className={styles.panelHeader}><h2>Agenda do dia</h2></div><div className={styles.list}>{calls?.map((call)=><Link className={styles.item} href={`/app/leads/${call.opportunity_id}`} key={call.id} prefetch={false}><span><strong>{new Date(call.starts_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} · {call.format}</strong><small>{call.status}</small></span></Link>)}{!calls?.length?<p className={styles.empty}>Nenhuma call hoje.</p>:null}</div></section></main>
      <aside><section className={styles.panel}><div className={styles.panelHeader}><h2>Próximas ações</h2></div><div className={styles.list}>{actions?.map((action)=><Link className={styles.item} href={`/app/leads/${action.opportunity_id}`} key={action.id} prefetch={false}><span><strong>{action.description}</strong><small>{new Date(action.due_at).toLocaleString('pt-BR')}</small></span></Link>)}{!actions?.length?<p className={styles.empty}>Tudo em dia.</p>:null}</div></section></aside></div>
  </div>;
}
