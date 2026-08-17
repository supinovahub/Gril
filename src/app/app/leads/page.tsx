import { CircleDot, Search, UserRoundPlus } from "lucide-react";
import Link from "next/link";

import { requireActiveViewer } from "@/lib/auth/session";
import { measureServerTask } from "@/lib/observability/server-performance";
import { createClient } from "@/lib/supabase/server";
import { ConversationViews } from "../inbox/conversation-views";
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
    .from("lead_list")
    .select("id,status,source,version,last_activity_at,assigned_membership_id,contact_id,contact_name,contact_status,primary_phone,stage_name,stage_code,stage_position")
    .eq("org_id", viewer.organization!.id)
    .eq("contact_status", showingArchived ? "archived" : "active")
    .order("last_activity_at", { ascending: false })
    .limit(100);

  if (q?.trim()) query = query.ilike("contact_name", `%${q.trim()}%`);

  const [{ data: opportunities }, { data: memberships }, { data: campaigns }] = await Promise.all([
    measureServerTask("leads.opportunity_list", () => query),
    measureServerTask(
      "leads.memberships",
      () => supabase
        .from("memberships")
        .select("id, role")
        .eq("org_id", viewer.organization!.id)
        .eq("status", "active"),
    ),
    measureServerTask(
      "leads.campaigns",
      () => supabase.from("campaigns").select("id,name").eq("org_id", viewer.organization!.id).in("status", ["draft", "pending_approval", "approved", "paused"]).order("created_at", { ascending: false }),
    ),
  ]);
  const contacts = Array.from(new Map((opportunities ?? []).flatMap((opportunity) => (
    opportunity.contact_id && opportunity.contact_name
      ? [[opportunity.contact_id, { id: opportunity.contact_id, name: opportunity.contact_name }] as const]
      : []
  ))).values());

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Conversas</p>
          <h1>Leads</h1>
          <p>Visualize o contexto comercial das pessoas que estão em atendimento.</p>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.secondaryButton} href={showingArchived ? "/app/leads" : "/app/leads?arquivados=1"} prefetch={false}>{showingArchived ? "Ver ativos" : "Ver arquivados"}</Link>
        </div>
      </header>

      <ConversationViews active="leads" />

      {erro ? <p className={styles.errorBanner}>{erro}</p> : null}
      {sucesso ? <p className={styles.successBanner}>Operação concluída.</p> : null}
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
              if (!opportunity.id || !opportunity.last_activity_at) return null;
              return (
                <Link className={styles.leadRow} href={`/app/leads/${opportunity.id}`} key={opportunity.id} prefetch={false}>
                  <span className={styles.leadAvatar}>{opportunity.contact_name?.slice(0, 1).toUpperCase() ?? "?"}</span>
                  <span className={styles.leadIdentity}>
                    <strong>{opportunity.contact_name ?? "Contato"}</strong>
                    <small>{opportunity.primary_phone ?? "Sem telefone visível"} · {sourceLabel(opportunity.source ?? "")}</small>
                  </span>
                  <span className={styles.stagePill}><CircleDot size={13} /> {opportunity.stage_name ?? opportunity.status}</span>
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
