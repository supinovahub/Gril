import { CircleDot, Search, UserRoundPlus } from "lucide-react";
import Link from "next/link";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { LeadForm } from "./lead-form";
import styles from "./leads.module.css";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; erro?: string }>;
}) {
  const viewer = await requireActiveViewer();
  const { q, erro } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("opportunities")
    .select("id, status, source, version, last_activity_at, assigned_membership_id, contacts!inner(id,name,contact_phones(e164,is_primary,status)), pipeline_stages!inner(name,code,position)")
    .eq("org_id", viewer.organization!.id)
    .order("last_activity_at", { ascending: false })
    .limit(100);

  if (q?.trim()) query = query.ilike("contacts.name", `%${q.trim()}%`);

  const [{ data: opportunities }, { data: memberships }] = await Promise.all([
    query,
    supabase
      .from("memberships")
      .select("id, role")
      .eq("org_id", viewer.organization!.id)
      .eq("status", "active"),
  ]);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>CRM operacional</p>
          <h1>Leads e oportunidades</h1>
          <p>Uma pessoa pode ter várias decisões de compra sem duplicar o contato.</p>
        </div>
        <Link className={styles.secondaryButton} href="/app/kanban">Abrir Kanban</Link>
      </header>

      {erro ? <p className={styles.errorBanner}>{erro}</p> : null}

      <section className={styles.layout}>
        <div className={styles.listPanel}>
          <form className={styles.searchBar}>
            <Search size={17} />
            <input defaultValue={q} name="q" placeholder="Buscar pelo nome" />
            <button type="submit">Buscar</button>
          </form>

          <div className={styles.listHeader}>
            <span>{opportunities?.length ?? 0} oportunidades visíveis</span>
            <span>Atualização mais recente primeiro</span>
          </div>

          <div className={styles.leadList}>
            {opportunities?.map((opportunity) => {
              const contact = Array.isArray(opportunity.contacts) ? opportunity.contacts[0] : opportunity.contacts;
              const stage = Array.isArray(opportunity.pipeline_stages) ? opportunity.pipeline_stages[0] : opportunity.pipeline_stages;
              const phones = (contact?.contact_phones ?? []) as Array<{
                e164: string;
                is_primary: boolean;
                status: string;
              }>;
              const phone = phones.find((item) => item.is_primary && item.status === "active")?.e164;
              return (
                <Link className={styles.leadRow} href={`/app/leads/${opportunity.id}`} key={opportunity.id}>
                  <span className={styles.leadAvatar}>{contact?.name?.slice(0, 1).toUpperCase() ?? "?"}</span>
                  <span className={styles.leadIdentity}>
                    <strong>{contact?.name ?? "Contato"}</strong>
                    <small>{phone ?? "Sem telefone visível"} · {opportunity.source}</small>
                  </span>
                  <span className={styles.stagePill}><CircleDot size={13} /> {stage?.name ?? opportunity.status}</span>
                  <time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(opportunity.last_activity_at))}</time>
                </Link>
              );
            })}
            {!opportunities?.length ? (
              <div className={styles.emptyState}><UserRoundPlus size={28} /><strong>Nenhum lead neste escopo</strong><span>Cadastre o primeiro usando o formulário ao lado.</span></div>
            ) : null}
          </div>
        </div>

        <LeadForm
          currentMembershipId={viewer.membership!.id}
          memberships={memberships ?? []}
          operations={viewer.operations}
        />
      </section>
    </div>
  );
}
