import { Funnel } from "lucide-react";
import Link from "next/link";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import styles from "../operations.module.css";

export default async function MyPipelinePage() {
  const viewer = await requireActiveViewer(); const supabase = await createClient();
  const { data: opportunities } = await supabase.from("opportunities").select("id,status,last_activity_at,contacts!inner(name,status),pipeline_stages(name,position)")
    .eq("org_id", viewer.organization!.id).eq("assigned_membership_id", viewer.membership!.id).eq("status", "open").eq("contacts.status", "active").order("last_activity_at", { ascending: false });
  const stages = new Map<string, typeof opportunities>();
  for (const item of opportunities ?? []) { const stage=(item.pipeline_stages as {name:string}|null)?.name ?? 'Sem etapa';stages.set(stage,[...(stages.get(stage)??[]),item]); }
  return <div className={styles.page}><header className={styles.header}><div><p className={styles.eyebrow}>Corretor</p><h1>Meu pipeline</h1><p>Somente as oportunidades atribuídas a você.</p></div><Funnel/></header>
    <section className={styles.panel}><div className={styles.list}>{Array.from(stages.entries()).map(([stage,items])=><article className={styles.item} key={stage}><span><strong>{stage}</strong><small>{items?.length ?? 0} oportunidades</small></span><div className={styles.actions}>{items?.map((item)=><Link href={`/app/leads/${item.id}`} key={item.id}>{(item.contacts as {name:string}|null)?.name ?? 'Lead'}</Link>)}</div></article>)}{!opportunities?.length?<p className={styles.empty}>Nenhuma oportunidade atribuída.</p>:null}</div></section>
  </div>;
}
