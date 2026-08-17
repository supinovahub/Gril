import { Building2, ContactRound, Megaphone, Search } from "lucide-react";
import { IntentPrefetchLink as Link } from "@/components/navigation/intent-prefetch-link";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import styles from "../leads/leads.module.css";

export default async function GlobalSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const viewer = await requireActiveViewer();
  const query = (await searchParams).q?.trim().slice(0, 120) ?? "";
  const supabase = await createClient();
  let contacts: Array<{ id: string; name: string; contact_phones: Array<{ e164: string; is_primary: boolean; status: string }>; opportunities: Array<{ id: string; status: string; last_activity_at: string; pipeline_stages: { name: string } | null }> }> = [];
  let projects: Array<{ id: string; name: string; neighborhood: string | null; region: string }> = [];
  let campaigns: Array<{ id: string; name: string; status: string; updated_at: string }> = [];

  if (query.length >= 2) {
    const digits = query.replace(/\D/g, "");
    const { data: phoneMatches } = digits.length >= 6
      ? await supabase.from("contact_phones").select("contact_id").ilike("e164", `%${digits}%`).limit(50)
      : { data: [] };
    const ids = phoneMatches?.map((item) => item.contact_id) ?? [];
    const contactFilter = ids.length ? `name.ilike.%${query.replace(/[%_,]/g, "")}%,id.in.(${ids.join(",")})` : `name.ilike.%${query.replace(/[%_,]/g, "")}%`;
    const [contactResult, projectResult, campaignResult] = await Promise.all([
      supabase.from("contacts").select("id,name,contact_phones(e164,is_primary,status),opportunities(id,status,last_activity_at,pipeline_stages(name))").eq("org_id", viewer.organization!.id).eq("status", "active").or(contactFilter).limit(50),
      supabase.from("projects").select("id,name,neighborhood,region").eq("org_id", viewer.organization!.id).ilike("name", `%${query}%`).limit(20),
      supabase.from("campaigns").select("id,name,status,updated_at").eq("org_id", viewer.organization!.id).ilike("name", `%${query}%`).limit(20),
    ]);
    contacts = (contactResult.data ?? []) as typeof contacts;
    projects = projectResult.data ?? [];
    campaigns = campaignResult.data ?? [];
    if (/^[0-9a-f-]{36}$/i.test(query)) {
      const { data: opportunity } = await supabase.from("opportunities").select("id,status,last_activity_at,contacts!inner(id,name,contact_phones(e164,is_primary,status)),pipeline_stages(name)").eq("id", query).maybeSingle();
      const person = opportunity && (Array.isArray(opportunity.contacts) ? opportunity.contacts[0] : opportunity.contacts);
      if (opportunity && person && !contacts.some((item) => item.id === person.id)) contacts.unshift({ id: person.id, name: person.name, contact_phones: person.contact_phones, opportunities: [{ id: opportunity.id, status: opportunity.status, last_activity_at: opportunity.last_activity_at, pipeline_stages: Array.isArray(opportunity.pipeline_stages) ? opportunity.pipeline_stages[0] : opportunity.pipeline_stages }] });
    }
  }

  return <div className={styles.page}><header className={styles.pageHeader}><div><p className={styles.eyebrow}>Busca global com escopo do papel</p><h1>Encontrar na operação</h1><p>Nome, telefone, ID da oportunidade, empreendimento ou campanha.</p></div></header><form className={styles.filterBar} action="/app/busca"><Search size={17}/><input autoFocus defaultValue={query} name="q" placeholder="Digite ao menos 2 caracteres"/><button type="submit">Buscar</button></form>{query.length>=2?<div className={styles.detailLayout}><main className={styles.detailMain}><section className={styles.detailCard}><div className={styles.cardTitle}><ContactRound size={18}/><h2>Leads e oportunidades</h2></div><div className={styles.actionList}>{contacts.flatMap((contact)=>contact.opportunities.map((opportunity)=><Link className={styles.actionRow} href={`/app/leads/${opportunity.id}`} key={opportunity.id} prefetch={false}><span><strong>{contact.name}</strong><small>{contact.contact_phones.find((phone)=>phone.is_primary&&phone.status==="active")?.e164??"Sem telefone"} · {opportunity.pipeline_stages?.name??opportunity.status}</small></span><time>{new Date(opportunity.last_activity_at).toLocaleDateString("pt-BR")}</time></Link>))}{!contacts.length?<p className={styles.mutedCopy}>Nenhum lead encontrado.</p>:null}</div></section></main><aside className={styles.detailAside}><section className={styles.compactCard}><h3><Building2 size={15}/> Empreendimentos</h3>{projects.map((project)=><Link href="/app/conhecimento" key={project.id}><strong>{project.name}</strong><span>{project.neighborhood??project.region}</span></Link>)}{!projects.length?<p>Nenhum resultado.</p>:null}</section><section className={styles.compactCard}><h3><Megaphone size={15}/> Campanhas</h3>{campaigns.map((campaign)=><Link href="/app/campanhas" key={campaign.id}><strong>{campaign.name}</strong><span>{campaign.status}</span></Link>)}{!campaigns.length?<p>Nenhum resultado.</p>:null}</section></aside></div>:<p className={styles.mutedCopy}>A busca começa depois de dois caracteres.</p>}</div>;
}
