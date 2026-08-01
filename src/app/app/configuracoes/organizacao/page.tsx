import { Building2, CirclePause, ShieldCheck } from "lucide-react";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { emergencyPauseAction, resumeEmergencyPauseAction, updateInstitutionalSettingsAction, updateOperationSettingsAction } from "./actions";
import styles from "../../operations.module.css";

type InstitutionalProfile = { company_name?: string;cnpj?: string;creci?: string;address?: string;site?: string;instagram?: string;privacy_contact?: string;source_name?: string;valid_until?: string };

export default async function OrganizationSettingsPage({ searchParams }: { searchParams: Promise<{ erro?: string;sucesso?: string }> }) {
  const viewer = await requireActiveViewer();
  const feedback = await searchParams;
  const operation = viewer.operations.find((item) => item.is_default) ?? viewer.operations[0];
  const supabase = await createClient();
  const [{ data: organizationSettings }, { data: operationSettings }, { data: pauses }] = await Promise.all([
    supabase.from("organization_settings").select("*").eq("org_id", viewer.organization!.id).single(),
    operation ? supabase.from("operation_settings").select("*").eq("operation_id", operation.id).single() : Promise.resolve({ data: null }),
    supabase.from("system_pauses").select("*").eq("org_id", viewer.organization!.id).eq("active", true).order("paused_at", { ascending: false }),
  ]);
  const institutional = (organizationSettings?.institutional_profile ?? {}) as InstitutionalProfile;
  const canManage = viewer.membership?.role === "owner" || viewer.permissions.includes("settings.manage");

  return <div className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>Fonte institucional</p><h1>Organização e operação</h1><p>Identidade, horários e limites usados pelo Pedro e pelas automações.</p></div><Building2 /></header>
    {feedback.erro ? <p className={styles.error}>{feedback.erro}</p> : null}
    {feedback.sucesso ? <p className={styles.success}>{feedback.sucesso}</p> : null}
    {pauses?.length ? <section className={styles.panel}><div className={styles.panelHeader}><h2>Pausa emergencial ativa</h2><span>{pauses.length}</span></div>{pauses.map((pause) => <article className={`${styles.item} ${styles.critical}`} key={pause.id}><span><strong>{pause.reason}</strong><small>Ativada em {new Date(pause.paused_at).toLocaleString("pt-BR")}</small></span>{viewer.membership?.role === "owner" ? <form action={resumeEmergencyPauseAction}><input name="pauseId" type="hidden" value={pause.id} /><input aria-label="Motivo da retomada" name="reason" placeholder="Motivo da retomada" required /><button>Retomar operação</button></form> : <b>Somente o dono retoma</b>}</article>)}</section> : null}
    <div className={styles.layout}><main className={styles.stack}>
      <form action={updateInstitutionalSettingsAction} className={styles.formCard}><h2>Identidade institucional</h2>
        <div className={styles.grid}><label><span>Nome exibido</span><input defaultValue={viewer.organization!.name} name="organizationName" required /></label><label><span>Razão social / nome legal</span><input defaultValue={institutional.company_name} name="companyName" required /></label><label><span>CNPJ</span><input defaultValue={institutional.cnpj} name="cnpj" /></label><label><span>CRECI</span><input defaultValue={institutional.creci} name="creci" required /></label></div>
        <label><span>Endereço</span><input defaultValue={institutional.address} name="address" /></label><div className={styles.grid}><label><span>Site</span><input defaultValue={institutional.site} name="site" type="url" /></label><label><span>Instagram</span><input defaultValue={institutional.instagram} name="instagram" /></label></div>
        <div className={styles.grid}><label><span>Contato de privacidade</span><input defaultValue={institutional.privacy_contact} name="privacyContact" required /></label><label><span>Fonte dos dados</span><input defaultValue={institutional.source_name} name="sourceName" required /></label><label><span>Válido até</span><input defaultValue={institutional.valid_until ?? ""} name="validUntil" type="date" required /></label><label><span>Orçamento mensal OpenAI (R$)</span><input defaultValue={organizationSettings?.ai_monthly_budget_brl ?? ""} min="0" name="aiMonthlyBudget" step="0.01" type="number" /></label></div>
        <button disabled={viewer.membership?.role !== "owner"}>Salvar identidade</button>
      </form>
      {operation && operationSettings ? <form action={updateOperationSettingsAction} className={styles.formCard}><h2>Regras da operação</h2><input name="operationId" type="hidden" value={operation.id} />
        <div className={styles.grid}><label><span>Nome</span><input defaultValue={operation.name} name="operationName" required /></label><label><span>Fuso</span><select defaultValue={operation.timezone} name="timezone"><option value="America/Sao_Paulo">America/Sao_Paulo</option><option value="America/Manaus">America/Manaus</option><option value="America/Cuiaba">America/Cuiaba</option><option value="America/Rio_Branco">America/Rio_Branco</option></select></label>
          <label><span>Inbound inicia</span><input defaultValue={String(operationSettings.inbound_window_start).slice(0,5)} name="inboundStart" type="time" /></label><label><span>Inbound encerra</span><input defaultValue={String(operationSettings.inbound_window_end).slice(0,5)} name="inboundEnd" type="time" /></label><label><span>Campanha inicia</span><input defaultValue={String(operationSettings.campaign_window_start).slice(0,5)} name="campaignStart" type="time" /></label><label><span>Campanha encerra</span><input defaultValue={String(operationSettings.campaign_window_end).slice(0,5)} name="campaignEnd" type="time" /></label>
          <label><span>Aberturas por minuto</span><input defaultValue={operationSettings.proactive_openings_per_minute} max="10" min="1" name="proactiveRate" type="number" /></label><label><span>Agrupamento inicial (s)</span><input defaultValue={operationSettings.grouping_seconds} max="30" min="1" name="groupingSeconds" type="number" /></label><label><span>Agrupamento máximo (s)</span><input defaultValue={operationSettings.max_grouping_seconds} max="60" min="10" name="maxGroupingSeconds" type="number" /></label><label><span>Número operacional</span><input defaultValue={operationSettings.operational_phone_e164 ?? ""} name="operationalPhone" placeholder="+5511999999999" /></label></div>
        <button disabled={!canManage}>Salvar regras operacionais</button>
      </form> : null}
    </main><aside className={styles.stack}><section className={styles.panel}><h2>Gate de produção</h2><p className={styles.definition}><ShieldCheck size={15} /> O banco exige identidade, persona, regras, qualificação, conhecimento válido, modelo principal e fallback, canal saudável e regressão real aprovada.</p></section>
      {operation ? <form action={emergencyPauseAction} className={styles.formCard}><h2><CirclePause size={17} /> Pausa emergencial</h2><input name="operationId" type="hidden" value={operation.id} /><label><span>Motivo obrigatório</span><textarea name="reason" required rows={3} /></label><button disabled={!canManage}>Pausar automações</button><p className={styles.definition}>Gestor pode pausar. Somente o dono pode retomar.</p></form> : null}
    </aside></div>
  </div>;
}
