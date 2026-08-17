import { BarChart3 } from "lucide-react";
import { requireActiveViewer } from "@/lib/auth/session";
import type { Database } from "@/lib/database.types";
import { measureServerTask } from "@/lib/observability/server-performance";
import { createClient } from "@/lib/supabase/server";
import styles from "../operations.module.css";

type ReportsWorkspacePayload = {
  authorized: boolean;
  campaignContactCount: number;
  capacity: Array<Pick<Database["public"]["Tables"]["operation_capacity"]["Row"], "active_count" | "proactive_paused" | "updated_at">>;
  completedResultCount: number;
  groups: {
    calls: Array<[string, number]>;
    campaigns: Array<[string, number]>;
    executions: Array<[string, number]>;
    opportunities: Array<[string, number]>;
    results: Array<[string, number]>;
    usage: Array<[string, number]>;
  };
  opportunityCount: number;
  projectedCost: number;
  settings: Pick<Database["public"]["Tables"]["organization_settings"]["Row"], "ai_monthly_budget_brl"> | null;
};

export default async function ReportsPage(){
  const supabase=await createClient();const[viewer,{data,error}]=await Promise.all([requireActiveViewer(),measureServerTask("reports.bootstrap",()=>supabase.rpc("reports_workspace_summary",{}))]);if(error)throw new Error("Não foi possível carregar os relatórios.");const payload=(data??{}) as unknown as ReportsWorkspacePayload;const{opportunityCount=0,campaignContactCount=0,completedResultCount=0,projectedCost=0,groups={opportunities:[],campaigns:[],calls:[],results:[],executions:[],usage:[]},capacity=[],settings=null}=payload;const canViewFinance=viewer.membership?.role==="owner"||viewer.permissions.includes("finance.view");
  return <div className={styles.page}><header className={styles.header}><div><p className={styles.eyebrow}>Definições auditáveis</p><h1>Relatórios</h1><p>Qualificação/agendamento e conversão comercial permanecem métricas separadas.</p></div><span className={styles.badge}><BarChart3 size={13}/> dados do tenant</span></header>
    <section className={styles.metrics}><div className={styles.metric}><small>Oportunidades</small><strong>{opportunityCount}</strong></div><div className={styles.metric}><small>Calls com resultado</small><strong>{completedResultCount}</strong></div><div className={styles.metric}><small>Contatos de campanha</small><strong>{campaignContactCount}</strong></div><div className={styles.metric}><small>Custo projetado em BRL</small><strong>{canViewFinance?Number(projectedCost).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}):"Restrito"}</strong><span>{settings?.ai_monthly_budget_brl?`orçamento ${Number(settings.ai_monthly_budget_brl).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`:'sem orçamento mensal'}</span></div></section>
    <div className={styles.grid}><Report title="Funil" rows={groups.opportunities} definition="Contagem pelo estado comercial atual; call realizada não é uma etapa."/><Report title="Campanhas" rows={groups.campaigns} definition="Contatos únicos por estado terminal/operacional; revalidações e opt-outs não são escondidos."/><Report title="Calls" rows={groups.calls} definition="Call realizada exige resultado humano; silêncio no WhatsApp não conta como no-show."/><Report title="Resultados" rows={groups.results} definition="Negociação, perdido, no-show e sem resultado são contabilizados separadamente."/><Report title="Autonomia Pedro" rows={groups.executions} definition="Modos shadow, assisted, production, simulator e regression não são misturados."/><Report title="Uso por carga" rows={groups.usage} definition="Atendimento, campanha, simulador e regressão permanecem separados. Custos só aparecem quando preço e câmbio foram configurados pela plataforma."/><Report title="Capacidade" rows={capacity.map((item,index)=>[`operação ${index+1}`,item.active_count])} definition="Conversas ativas; 25 pausa proativo e 30 é o limite duro."/></div>
  </div>;
}

function Report({title,rows,definition}:{title:string;rows:Array<[string,number]>;definition:string}){return <section className={styles.panel}><div className={styles.panelHeader}><h2>{title}</h2><span>{rows.reduce((sum,row)=>sum+row[1],0)}</span></div><table className={styles.table}><tbody>{rows.map(([name,value])=><tr key={name}><td>{name}</td><td>{value}</td></tr>)}</tbody></table>{!rows.length?<p className={styles.empty}>Sem dados.</p>:null}<p className={styles.definition}>{definition}</p></section>}
