import { Bot, BrainCircuit, CheckCircle2, CircleDashed, KeyRound, RefreshCw, ShieldCheck, Sparkles, Trash2 } from "lucide-react";

import { retestIntegrationAction, revokeIntegrationAction } from "@/app/app/integration-actions";
import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { addPersonaSampleAction, changeGlobalAiModeAction, clonePersonaAction, configureFallbackModelAction, configureModelAction, connectOpenAiAction, createPersonaDraftAction, publishPersonaAction } from "./actions";
import styles from "./pedro.module.css";

export default async function PedroPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const viewer = await requireActiveViewer();
  const feedback = await searchParams;
  const supabase = await createClient();
  const [settingsResult, personasResult, versionsResult, modelsResult, rulesResult, executionsResult, integrationsResult, samplesResult] = await Promise.all([
    supabase.from("organization_settings").select("*").eq("org_id", viewer.organization!.id).single(),
    supabase.from("personas").select("*").eq("org_id", viewer.organization!.id).eq("status", "active").order("name"),
    supabase.from("persona_versions").select("*").eq("org_id", viewer.organization!.id).order("version", { ascending: false }),
    supabase.from("model_profiles").select("*").eq("org_id", viewer.organization!.id).order("workload_role"),
    supabase.from("rule_versions").select("id,version,status,checksum,published_at").eq("org_id", viewer.organization!.id).order("version", { ascending: false }),
    supabase.from("ai_executions").select("id,mode,status,model_returned,error_code,created_at").eq("org_id", viewer.organization!.id).order("created_at", { ascending: false }).limit(10),
    supabase.from("integration_accounts").select("*").eq("org_id", viewer.organization!.id).eq("provider", "openai").order("created_at", { ascending: false }),
    supabase.from("persona_samples").select("id,persona_id,status,extraction,created_at").eq("org_id", viewer.organization!.id).order("created_at", { ascending: false }),
  ]);
  const settings = settingsResult.data;
  const defaultPersona = personasResult.data?.[0];
  const published = versionsResult.data?.find((item) => item.persona_id === defaultPersona?.id && item.status === "published");
  const drafts = versionsResult.data?.filter((item) => item.persona_id === defaultPersona?.id && item.status === "draft") ?? [];
  const openAiAccount = integrationsResult.data?.find((item) => item.status !== "revoked");

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}><div><p className={styles.eyebrow}>Motor versionado</p><h1>Pedro</h1><p>Persona, regras, modelo e modos de execução com snapshots reproduzíveis.</p></div><span className={styles.modeBadge}><Bot size={15} /> {settings?.ai_global_mode ?? "off"}</span></header>
      {feedback.erro ? <p className={styles.errorBanner}>{feedback.erro}</p> : null}
      {feedback.sucesso ? <p className={styles.successBanner}>{feedback.sucesso}</p> : null}

      <section className={styles.statusStrip}>
        <div><BrainCircuit size={18} /><span><small>Persona publicada</small><strong>v{published?.version ?? "—"}</strong></span></div>
        <div><ShieldCheck size={18} /><span><small>Regras publicadas</small><strong>v{rulesResult.data?.find((item) => item.status === "published")?.version ?? "—"}</strong></span></div>
        <div><Sparkles size={18} /><span><small>Modelo ativo</small><strong>{modelsResult.data?.find((item) => item.status === "active" && item.is_default)?.model_identifier ?? "Pendente"}</strong></span></div>
      </section>

      <div className={styles.grid}>
        <div className={styles.mainColumn}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}><span><p className={styles.eyebrow}>Persona e estilo</p><h2>{defaultPersona?.name ?? "Pedro"}</h2></span><span className={styles.versionChip}>publicada · v{published?.version}</span></div>
            <form action={createPersonaDraftAction} className={styles.promptForm}>
              <input name="personaId" type="hidden" value={defaultPersona?.id} />
              <label><span>Contrato compilado</span><textarea defaultValue={published?.compiled_prompt} name="compiledPrompt" rows={14} required /></label>
              <p>Editar cria uma nova versão em rascunho. Conversas existentes mantêm o snapshot anterior.</p>
              <button type="submit">Criar nova versão</button>
            </form>
            {drafts.map((draft) => (
              <article className={styles.draftRow} key={draft.id}><span><strong>Rascunho v{draft.version}</strong><small>{draft.checksum.slice(0, 12)}…</small></span>{viewer.membership?.role === "owner" ? <form action={publishPersonaAction}><input name="personaVersionId" type="hidden" value={draft.id} /><button type="submit">Publicar</button></form> : null}</article>
            ))}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}><span><p className={styles.eyebrow}>Construtor guiado</p><h2>Amostras e clones</h2></span><span className={styles.versionChip}>{samplesResult.data?.filter((item)=>item.persona_id===defaultPersona?.id && item.status==='confirmed').length ?? 0} / 10–30</span></div>
            <form action={addPersonaSampleAction} className={styles.promptForm}>
              <label><span>Persona</span><select name="personaId" required>{personasResult.data?.map((persona)=><option key={persona.id} value={persona.id}>{persona.name}</option>)}</select></label>
              <label><span>Conversa de exemplo</span><textarea name="sample" placeholder="Cole uma conversa. Telefones, e-mails, documentos e valores serão mascarados antes da análise." required rows={8}/></label>
              <p>O original fica protegido somente durante o rascunho e por no máximo 30 dias. Na publicação, permanecem apenas padrões e exemplos anonimizados confirmados.</p>
              <button type="submit">Mascarar e analisar amostra</button>
            </form>
            <form action={clonePersonaAction} className={styles.promptForm}>
              <input name="sourcePersonaId" type="hidden" value={defaultPersona?.id}/>
              <label><span>Nome da nova persona</span><input name="name" required/></label>
              <label><span>Código interno</span><input name="code" pattern="[a-z0-9_]+" placeholder="pedro_investidor" required/></label>
              <button type="submit">Clonar para novo rascunho</button>
            </form>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}><span><p className={styles.eyebrow}>BYOK</p><h2>Perfis de modelo</h2></span></div>
            {viewer.membership?.role === "owner" ? <div className={styles.credentialPanel}>
              <div className={styles.credentialSummary}>
                <span className={styles.modelState}>{openAiAccount?.status === "verified" ? <CheckCircle2 size={19} /> : <CircleDashed size={19} />}</span>
                <span><strong>{openAiAccount ? "OpenAI conectada" : "Conecte sua chave da OpenAI"}</strong><small>{openAiAccount ? `${openAiAccount.credential_hint} · ${openAiAccount.status}` : "A chave será testada antes de entrar no Vault."}</small></span>
                {openAiAccount ? <div className={styles.credentialActions}>
                  <form action={retestIntegrationAction}><input name="integrationAccountId" type="hidden" value={openAiAccount.id}/><input name="returnTo" type="hidden" value="/app/pedro"/><button type="submit"><RefreshCw size={13}/> Testar</button></form>
                  <form action={revokeIntegrationAction}><input name="integrationAccountId" type="hidden" value={openAiAccount.id}/><input name="returnTo" type="hidden" value="/app/pedro"/><button className={styles.dangerAction} type="submit"><Trash2 size={13}/> Revogar</button></form>
                </div> : null}
              </div>
              <form action={connectOpenAiAction} className={styles.keyForm}>
                <label><span>{openAiAccount ? "Nova chave para rotação" : "Chave de API"}</span><input autoComplete="new-password" name="apiKey" placeholder="sk-..." spellCheck={false} type="password" required /></label>
                <button type="submit"><KeyRound size={14}/> {openAiAccount ? "Validar e trocar" : "Validar e conectar"}</button>
              </form>
              <p className={styles.credentialNotice}><ShieldCheck size={14}/> A chave nunca é reexibida e só workers server-side podem recuperá-la.</p>
            </div> : null}
            <div className={styles.modelList}>
              {modelsResult.data?.map((profile) => (
                <form action={configureModelAction} className={styles.modelRow} key={profile.id}>
                  <input name="profileId" type="hidden" value={profile.id} />
                  <span className={styles.modelState}>{profile.status === "active" ? <CheckCircle2 size={18} /> : <CircleDashed size={18} />}</span>
                  <span className={styles.modelCopy}><strong>{profile.name}</strong><small>{profile.workload_role} · Responses API · {profile.status}</small></span>
                  <span className={styles.keyState}>{profile.secret_reference ? "chave vinculada" : "sem chave"}</span>
                  <select defaultValue={profile.reasoning_effort ?? "medium"} disabled={profile.status !== "draft"} name="reasoningEffort"><option value="none">none</option><option value="low">low</option><option value="medium">medium</option><option value="high">high</option><option value="xhigh">xhigh</option><option value="max">max</option></select>
                  <select defaultValue={profile.text_verbosity} disabled={profile.status !== "draft"} name="textVerbosity"><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select>
                  {profile.status === "draft" ? <label className={styles.activateCheck}><input name="activate" type="checkbox" /> ativar</label> : <span className={styles.activeLabel}>ativo</span>}
                  {profile.status === "draft" ? <button type="submit">Salvar</button> : null}
                </form>
              ))}
            </div>
            {viewer.membership?.role === "owner" ? <form action={configureFallbackModelAction} className={styles.keyForm}>
              <label><span>Modelo secundário para falhas transitórias</span><select defaultValue={settings?.fallback_model_profile_id ?? ""} name="fallbackModelProfileId" required><option value="">Selecione</option>{modelsResult.data?.filter((profile) => profile.secret_reference && !profile.is_default).map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {profile.model_identifier}</option>)}</select></label>
              <button type="submit">Salvar fallback</button>
            </form> : null}
          </section>
        </div>

        <aside className={styles.sideColumn}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}><span><p className={styles.eyebrow}>Ativação</p><h2>Modo global</h2></span></div>
            <form action={changeGlobalAiModeAction} className={styles.modeForm}>
              {["off", "shadow", "assisted", "production"].map((mode) => <button className={settings?.ai_global_mode === mode ? styles.selectedMode : ""} name="mode" type="submit" value={mode} key={mode}>{mode}</button>)}
            </form>
            <p className={styles.notice}>Produção exige identidade institucional, persona, regras, qualificação, conhecimento válido, modelo principal e fallback, canal saudável e regressão real aprovada.</p>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHeader}><span><p className={styles.eyebrow}>Últimas execuções</p><h2>Rastreabilidade</h2></span></div>
            <div className={styles.executionList}>{executionsResult.data?.map((execution) => <article key={execution.id}><span><strong>{execution.mode}</strong><small>{new Date(execution.created_at).toLocaleString("pt-BR")}</small></span><span className={styles.versionChip}>{execution.status}</span></article>)}{!executionsResult.data?.length ? <p className={styles.notice}>Nenhuma execução solicitada.</p> : null}</div>
          </section>
        </aside>
      </div>
    </div>
  );
}
