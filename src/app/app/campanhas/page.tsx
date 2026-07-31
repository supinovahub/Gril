import { CircleAlert, FileSpreadsheet, Megaphone, Pause, Play, ShieldCheck } from "lucide-react";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createCampaignAction, importCampaignAction, releaseWaveAction, transitionCampaignAction } from "./actions";
import styles from "./campaigns.module.css";

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const viewer = await requireActiveViewer(); const feedback = await searchParams; const supabase = await createClient();
  const [{ data: campaigns }, { data: connections }, { data: contacts }, { data: imports }, { data: waves }] = await Promise.all([
    supabase.from("campaigns").select("*,whatsapp_connections(name,phone_e164,provider)").eq("org_id",viewer.organization!.id).order("created_at",{ascending:false}),
    supabase.from("whatsapp_connections").select("id,name,phone_e164,provider").eq("org_id",viewer.organization!.id).eq("status","active").eq("campaign_enabled",true),
    supabase.from("campaign_contacts").select("campaign_id,status").eq("org_id",viewer.organization!.id),
    supabase.from("campaign_imports").select("campaign_id,total_rows,valid_rows,duplicate_rows,error_rows,status,created_at").eq("org_id",viewer.organization!.id).order("created_at",{ascending:false}),
    supabase.from("campaign_waves").select("campaign_id,wave_number,released_count,suppressed_count,status,released_at").eq("org_id",viewer.organization!.id).order("wave_number",{ascending:false}),
  ]);
  return <div className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>Reativação controlada</p><h1>Campanhas</h1><p>Importe, revise e libere ondas explícitas de 20, 50 e restante. Nada sai apenas por criar a campanha.</p></div><span className={styles.limit}><ShieldCheck size={16}/> até 500 contatos</span></header>
    {feedback.erro ? <p className={styles.error}>{feedback.erro}</p> : null}{feedback.sucesso ? <p className={styles.success}>{feedback.sucesso}</p> : null}
    {!connections?.length ? <p className={styles.warning}><CircleAlert size={16}/> Ative uma conexão WhatsApp e habilite “campanhas” antes de criar a primeira campanha.</p> : null}
    <div className={styles.layout}><main className={styles.list}>
      {campaigns?.map((campaign) => { const stats=(contacts??[]).filter((item)=>item.campaign_id===campaign.id).reduce<Record<string,number>>((acc,item)=>{acc[item.status]=(acc[item.status]??0)+1;return acc;},{}); const latestImport=(imports??[]).find((item)=>item.campaign_id===campaign.id); const campaignWaves=(waves??[]).filter((item)=>item.campaign_id===campaign.id); const conn=campaign.whatsapp_connections as {name:string;phone_e164:string|null;provider:string}|null; return <article className={styles.card} key={campaign.id}>
        <div className={styles.cardHeader}><span className={styles.icon}><Megaphone size={18}/></span><span><strong>{campaign.name}</strong><small>{conn?.name} · {conn?.phone_e164 ?? conn?.provider} · IA {campaign.ai_mode}</small></span><b data-status={campaign.status}>{campaign.status}</b></div>
        <div className={styles.metrics}><span><small>Prontos</small><strong>{stats.ready??0}</strong></span><span><small>Na fila</small><strong>{stats.queued??0}</strong></span><span><small>Suprimidos</small><strong>{stats.suppressed??0}</strong></span><span><small>Ondas</small><strong>{campaignWaves.length}</strong></span></div>
        {latestImport ? <p className={styles.importSummary}>Última base: {latestImport.valid_rows} válidos · {latestImport.duplicate_rows} duplicados · {latestImport.error_rows} erros</p> : null}
        {campaign.status==="draft"||campaign.status==="importing"||campaign.status==="review" ? <form action={importCampaignAction} className={styles.importForm}><input name="campaignId" type="hidden" value={campaign.id}/><label><span>CSV com nome e telefone E.164</span><input accept=".csv,text/csv" name="csvFile" type="file"/></label><label><span>Ou cole o CSV</span><textarea name="csvText" placeholder={'nome,telefone\nMaria,+5511999999999'} rows={3}/></label><button><FileSpreadsheet size={15}/> Processar base</button></form> : null}
        <div className={styles.actions}>
          {campaign.status==="review" ? <form action={transitionCampaignAction}><input name="campaignId" type="hidden" value={campaign.id}/><input name="expectedVersion" type="hidden" value={campaign.version}/><input name="action" type="hidden" value="approve"/><button>Aprovar campanha</button></form> : null}
          {campaign.status==="approved"||campaign.status==="running" ? <form action={releaseWaveAction}><input name="campaignId" type="hidden" value={campaign.id}/><input max={campaignWaves.length===0?20:campaignWaves.length===1?50:500} min="1" name="count" defaultValue={campaignWaves.length===0?20:campaignWaves.length===1?50:100} type="number"/><button><Play size={14}/> Liberar onda</button></form> : null}
          {campaign.status==="running" ? <form action={transitionCampaignAction}><input name="campaignId" type="hidden" value={campaign.id}/><input name="expectedVersion" type="hidden" value={campaign.version}/><input name="action" type="hidden" value="pause"/><button className={styles.secondary}><Pause size={14}/> Pausar</button></form> : null}
          {campaign.status==="paused" ? <form action={transitionCampaignAction}><input name="campaignId" type="hidden" value={campaign.id}/><input name="expectedVersion" type="hidden" value={campaign.version}/><input name="action" type="hidden" value="resume"/><button><Play size={14}/> Retomar</button></form> : null}
        </div>
      </article>; })}
      {!campaigns?.length ? <section className={styles.empty}><Megaphone size={25}/><h2>Nenhuma campanha</h2><p>Conecte um número, declare a origem da base e crie um rascunho.</p></section> : null}
    </main><aside><form action={createCampaignAction} className={styles.createForm}><div><p className={styles.eyebrow}>Nova campanha</p><h2>Preparar reativação</h2></div><label><span>Nome</span><input name="name" required/></label><label><span>Conexão ativa</span><select name="connectionId" required><option value="">Selecione</option>{connections?.map((connection)=><option key={connection.id} value={connection.id}>{connection.name} · {connection.phone_e164??connection.provider}</option>)}</select></label><label><span>Modo do Pedro</span><select name="aiMode"><option value="off">Desligado</option><option value="shadow">Sombra</option><option value="assisted">Assistido</option><option value="production">Produção nesta campanha</option></select></label><label><span>Abertura</span><textarea name="openingTemplate" defaultValue="Olá {{name}}, tudo bem? Podemos retomar seu atendimento sobre imóveis?" rows={3}/></label><label><span>Declaração de consentimento</span><textarea name="consentStatement" defaultValue="Confirmo que esta base possui autorização válida para contato comercial via WhatsApp." rows={3}/></label><label><span>Origem da base</span><input name="consentSource" placeholder="CRM próprio, evento, formulário..."/></label><label className={styles.check}><input name="consentConfirmed" type="checkbox"/> Confirmo a declaração acima</label><button disabled={!connections?.length}>Criar rascunho</button></form></aside></div>
  </div>;
}
