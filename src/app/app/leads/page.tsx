import { CircleDot, Search, UserRoundPlus } from "lucide-react";
import { IntentPrefetchLink as Link } from "@/components/navigation/intent-prefetch-link";

import { requireActiveViewer } from "@/lib/auth/session";
import type { Tables } from "@/lib/database.types";
import { measureServerTask } from "@/lib/observability/server-performance";
import { createClient } from "@/lib/supabase/server";
import { ConversationViews } from "../inbox/conversation-views";
import { LeadForm } from "./lead-form";
import { BulkCrmPanel } from "./bulk-crm-panel";
import styles from "./leads.module.css";

type LeadListRow = Pick<
  Tables<"opportunities">,
  "id" | "status" | "source" | "version" | "last_activity_at" | "assigned_membership_id"
> & {
  contact_id: string;
  contact_name: string;
  contact_status: string;
  primary_phone: string | null;
  stage_name: string;
  stage_code: string;
  stage_position: number;
};

type LeadsWorkspacePayload = {
  authorized: boolean;
  opportunities: LeadListRow[];
  memberships: Array<Pick<Tables<"memberships">, "id" | "role">>;
  campaigns: Array<Pick<Tables<"campaigns">, "id" | "name">>;
};

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
  const paramsPromise = searchParams;
  const workspacePromise = (async () => {
    const params = await paramsPromise;
    const supabase = await createClient();
    return measureServerTask(
      "leads.workspace",
      () => supabase.rpc("leads_workspace_bootstrap", {
        p_archived: params.arquivados === "1",
        p_search: params.q?.trim() || undefined,
      }),
    );
  })();
  const [viewer, params, workspaceResult] = await Promise.all([
    requireActiveViewer(),
    paramsPromise,
    workspacePromise,
  ]);
  const { q, arquivados, erro, sucesso } = params;
  const showingArchived = arquivados === "1";
  if (workspaceResult.error) {
    console.error("Failed to load Leads workspace", workspaceResult.error);
    throw new Error("Não foi possível carregar os leads.");
  }
  const workspace = workspaceResult.data as unknown as LeadsWorkspacePayload;
  const { opportunities, memberships, campaigns } = workspace;
  const contacts = Array.from(new Map(opportunities.flatMap((opportunity) => (
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
      <BulkCrmPanel contacts={contacts} managers={memberships.filter((item)=>item.role!=='broker').map((item)=>({ id:item.id,label:`${item.role} · ${item.id.slice(0,8)}` }))} campaigns={campaigns.map((item)=>({id:item.id,label:item.name}))}/>

      <section className={styles.layout}>
        <div className={styles.listPanel}>
          <form className={styles.searchBar}>
            <Search size={17} />
            <input defaultValue={q} name="q" placeholder="Buscar pelo nome" />
            <button type="submit">Buscar</button>
          </form>

          <div className={styles.listHeader}>
            <span>{opportunities.length} oportunidades {showingArchived ? "arquivadas" : "ativas"}</span>
            <span>Atualização mais recente primeiro</span>
          </div>

          <div className={styles.leadList}>
            {opportunities.map((opportunity) => {
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
            {!opportunities.length ? (
              <div className={styles.emptyState}><UserRoundPlus size={28} /><strong>Nenhum lead neste escopo</strong><span>Cadastre o primeiro usando o formulário ao lado.</span></div>
            ) : null}
          </div>
        </div>

        <LeadForm
          currentMembershipId={viewer.membership!.id}
          memberships={memberships}
          operations={viewer.operations}
        />
      </section>
    </div>
  );
}
