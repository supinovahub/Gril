import { CircleDot, ListFilter } from "lucide-react";
import Link from "next/link";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import styles from "../leads/leads.module.css";

export default async function KanbanPage() {
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const [{ data: stages }, { data: opportunities }] = await Promise.all([
    supabase.from("pipeline_stages").select("*").eq("org_id", viewer.organization!.id).eq("is_active", true).order("position"),
    supabase.from("opportunities").select("id,status,source,last_activity_at,pipeline_stage_id,assigned_membership_id,unit_quantity,amount_scope,contacts!inner(name,status,contact_phones(e164,is_primary,status)),opportunity_scores(score,explanation,created_at)").eq("org_id", viewer.organization!.id).eq("contacts.status", "active").order("last_activity_at", { ascending: false }),
  ]);

  return (
    <div className={styles.kanbanPage}>
      <header className={styles.pageHeader}>
        <div><p className={styles.eyebrow}>Pipeline fixo do MVP</p><h1>Kanban comercial</h1><p>Pedro atua nas três primeiras etapas; o corretor recebe o fluxo humano.</p></div>
        <Link className={styles.secondaryButton} href="/app/leads"><ListFilter size={15} /> Ver lista</Link>
      </header>

      <div className={styles.kanbanBoard}>
        {stages?.map((stage) => {
          const cards = opportunities?.filter((item) => item.pipeline_stage_id === stage.id) ?? [];
          return (
            <section className={styles.kanbanColumn} key={stage.id}>
              <header><span><CircleDot size={13} /> {stage.name}</span><strong>{cards.length}</strong></header>
              <div>
                {cards.map((card) => {
                  const contact = Array.isArray(card.contacts) ? card.contacts[0] : card.contacts;
                  const phones = (contact?.contact_phones ?? []) as Array<{
                    e164: string;
                    is_primary: boolean;
                    status: string;
                  }>;
                  const phone = phones.find((item) => item.is_primary && item.status === "active")?.e164;
                  const score = [...(card.opportunity_scores ?? [])].sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];
                  const band = (score?.explanation as { band?: string } | null)?.band;
                  return (
                    <Link className={styles.kanbanCard} href={`/app/leads/${card.id}`} key={card.id}>
                      <strong>{contact?.name ?? "Contato"}</strong>
                      <span>{phone ?? "Telefone oculto"}</span>
                      <small>{card.source} · {card.assigned_membership_id ? "atribuído" : "sem responsável"} · {card.unit_quantity} un.</small>
                      {score ? <small>{band ?? "score"} · {score.score}/100</small> : null}
                      <time>{new Date(card.last_activity_at).toLocaleDateString("pt-BR")}</time>
                    </Link>
                  );
                })}
                {!cards.length ? <p className={styles.emptyColumn}>Nenhum lead</p> : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
