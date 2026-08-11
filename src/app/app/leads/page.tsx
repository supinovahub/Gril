import { CircleDot, Search, UserRoundPlus } from "lucide-react";
import Link from "next/link";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { LeadForm } from "./lead-form";
import { BulkCrmPanel } from "./bulk-crm-panel";
import styles from "./leads.module.css";

function sourceLabel(source: string) {
  if (source === "whatsapp_inbound" || source === "whatsapp_device") return "WhatsApp";
  if (source === "campaign") return "Campanha";
  if (source === "meta_form") return "Formulário Meta";
  return "Origem não informada";
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; arquivados?: string; erro?: string; sucesso?: string }>;
}) {
  const viewer = await requireActiveViewer();
  const { q, arquivados, erro, sucesso } = await searchParams;
  const showingArchived = arquivados === "1";
  const supabase = await createClient();
  let query = supabase
    .from("opportunities")
    .select("id, status, source, version, last_activity_at, assigned_membership_id, contacts!inner(id,name,status,contact_phones(e164,is_primary,status)), pipeline_stages!inner(name,code,position)")
    .eq("org_id", viewer.organization!.id)
    .eq("contacts.status", showingArchived ? "archived" : "active")
    .order("last_activity_at", { ascending: false })
    .limit(100);

  if (q?.trim()) query = query.ilike("contacts.name", `%${q.trim()}%`);

  const [{ data: opportunities }, { data: memberships }, { data: campaigns }] = await Promise.all([
    query,
    supabase
      .from("memberships")
      .select("id, role")
      .eq("org_id", viewer.organization!.id)
      .eq("status", "active"),
    supabase.from("campaigns").select("id,name").eq("org_id", viewer.organization!.id).in("status", ["draft", "pending_approval", "approved", "paused"]).order("created_at", { ascending: false }),
  ]);
  const contacts = Array.from(new Map((opportunities ?? []).map((opportunity)=>{
    const contact = Array.isArray(opportunity.contacts) ? opportunity.contacts[0] : opportunity.contacts;
    return contact ? [contact.id, { id: contact.id, name: contact.name }] : ["", null];
  }).filter((entry): entry is [string,{id:string;name:string}]=>Boolean(entry[0] && entry[1]))).values());

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Gestão comercial</p>
          <h1>Leads e oportunidades</h1>
          <p>Cada linha representa uma oportunidade de compra. A mesma pessoa pode ter mais de uma oportunidade sem duplicar o contato.</p>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.secondaryButton} href={showingArchived ? "/app/leads" : "/app/leads?arquivados=1"}>{showingArchived ? "Ver ativos" : "Ver arquivados"}</Link>
          <Link className={styles.secondaryButton} href="/app/kanban">Abrir Kanban</Link>
        </div>
      </header>

      {erro ? <p className={styles.errorBanner}>{erro}</p> : null}
      {sucesso ? <p className={styles.successBanner}>Operação concluída.</p> : null}
      <section className={styles.crmGuide} aria-label="Como usar o CRM">
        <div><strong>Como trabalhar um lead</strong><span>Abra uma oportunidade para completar a qualificação e escolher o próximo passo.</span></div>
        <ol><li><b>1</b>Confira o contexto e o responsável.</li><li><b>2</b>Preencha os dados que ainda faltam.</li><li><b>3</b>Avance a etapa ou agende uma call.</li></ol>
      </section>
      <BulkCrmPanel contacts={contacts} managers={(memberships ?? []).filter((item)=>item.role!=='broker').map((item)=>({ id:item.id,label:`${item.role} · ${item.id.slice(0,8)}` }))} campaigns={(campaigns ?? []).map((item)=>({id:item.id,label:item.name}))}/>

      <section className={styles.layout}>
        <div className={styles.listPanel}>
          <form className={styles.searchBar}>
            <Search size={17} />
            <input defaultValue={q} name="q" placeholder="Buscar pelo nome" />
            <button type="submit">Buscar</button>
          </form>

          <div className={styles.listHeader}>
            <span>{opportunities?.length ?? 0} oportunidades {showingArchived ? "arquivadas" : "ativas"}</span>
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
                    <small>{phone ?? "Sem telefone visível"} · {sourceLabel(opportunity.source)}</small>
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
