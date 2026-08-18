import { Bot, BrainCircuit, CheckCircle2, CircleDashed, KeyRound, RefreshCw, ShieldCheck, Sparkles, Trash2 } from "lucide-react";

import { retestIntegrationAction, revokeIntegrationAction } from "@/app/app/integration-actions";
import { IntentPrefetchLink as Link } from "@/components/navigation/intent-prefetch-link";
import { getInboundModeOptions } from "@/lib/ai/inbound-mode-options";
import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { addAiTestNumberAction, addPersonaSampleAction, changeGlobalAiModeAction, clonePersonaAction, configureFallbackModelAction, configureModelAction, configureReactivationAiAction, connectOpenAiAction, createPersonaDraftAction, publishPersonaAction, removeAiTestNumberAction } from "./actions";
import styles from "./pedro.module.css";

const modeLabels: Record<string, string> = {
  off: "Desligado",
  shadow: "Só observa",
  assisted: "Sugere para revisão",
  production: "Responde automaticamente",
};

const modeDescriptions: Record<string, string> = {
  off: "Pedro não analisa nem responde às conversas.",
  shadow: "Pedro analisa as conversas, mas não cria sugestões nem envia mensagens.",
  assisted: "Pedro prepara sugestões. A equipe revisa e decide o que será enviado.",
  production: "Pedro pode aplicar ações e enviar automaticamente quando os gates estiverem liberados.",
};

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
  const publishedRules = rulesResult.data?.find((item) => item.status === "published");
  const drafts = versionsResult.data?.filter((item) => item.persona_id === defaultPersona?.id && item.status === "draft") ?? [];
  const openAiAccount = integrationsResult.data?.find((item) => item.status !== "revoked");
  const { data: allowlist } = await supabase.from("ai_test_allowlist").select("id,phone_e164,active").eq("org_id", viewer.organization!.id).eq("active", true).order("created_at");
  const inboundMode = settings?.inbound_ai_mode ?? settings?.ai_global_mode ?? "off";
  const hasAllowlistedNumber = Boolean(allowlist?.length);
  const inboundModes = getInboundModeOptions(hasAllowlistedNumber);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}><div><p className={styles.eyebrow}>Configuração de atendimento</p><h1>Pedro</h1><p>Defina como Pedro participa das conversas e revise o que pode ser enviado automaticamente.</p></div><div className={styles.headerActions}><Link className={styles.learningLink} href="/app/aprendizados"><BrainCircuit size={14} /> Melhoria contínua</Link><span className={styles.modeBadge}><Bot size={15} /> Pedro: {modeLabels[inboundMode] ?? inboundMode}</span></div></header>
      {feedback.erro ? <p className={styles.errorBanner}>{feedback.erro}</p> : null}
      {feedback.sucesso ? <p className={styles.successBanner}>{feedback.sucesso}</p> : null}

      <section className={styles.statusStrip}>
        <div><BrainCircuit size={18} /><span><small>Persona publicada</small><strong>{published?.version ? `v${published.version}` : "Não publicada"}</strong></span></div>
        <div><ShieldCheck size={18} /><span><small>Regras publicadas</small><strong>{publishedRules?.version ? `v${publishedRules.version}` : "Não publicadas"}</strong></span></div>
        <div><Sparkles size={18} /><span><small>Modelo ativo</small><strong>{modelsResult.data?.find((item) => item.status === "active" && item.is_default)?.model_identifier ?? "Pendente"}</strong></span></div>
      </section>

      <section className={styles.modeSummary} aria-labelledby="pedro-current-mode-title">
        <div><p className={styles.eyebrow}>Comportamento atual</p><h2 id="pedro-current-mode-title">{modeLabels[inboundMode] ?? inboundMode}</h2><p>{modeDescriptions[inboundMode] ?? "Confira o modo selecionado antes de liberar o atendimento."}</p></div>
        <span>Para começar, recomendamos <strong>Sugere para revisão</strong>.</span>
      </section>

      <nav aria-label="Seções de configuração do Pedro" className={styles.pedroTabs}>
        <a href="#comportamentos">Comportamentos</a>
        <a href="#persona">Persona</a>
        <a href="#modelos">Modelos</a>
        <a href="#testes">Testes e histórico</a>
      </nav>

      <section className={styles.behaviorGrid} id="comportamentos" aria-label="Comportamentos do Pedro">
        <article className={styles.behaviorPanel}>
          <header><span><p className={styles.eyebrow}>Atendimento via WhatsApp</p><h2>Conversas recebidas</h2></span><span className={styles.behaviorState}>{modeLabels[inboundMode] ?? inboundMode}</span></header>
          <p>Controle como Pedro participa das conversas iniciadas pelo lead. Ter um número na whitelist apenas mostra a opção automática; a ativação continua sendo uma escolha explícita do dono.</p>
          <form action={changeGlobalAiModeAction} className={styles.modeForm}>
            {inboundModes.map((mode) => <button className={inboundMode === mode ? styles.selectedMode : ""} name="mode" type="submit" value={mode} key={mode}>{modeLabels[mode]}</button>)}
          </form>
          <p>{hasAllowlistedNumber ? "A opção Responde automaticamente está visível. Selecioná-la ainda exige os demais gates de produção, e somente números ativos da whitelist podem receber respostas automáticas no inbound normal." : "Cadastre um número autorizado para que Responde automaticamente apareça entre os modos."}</p>
        </article>
        <article className={styles.behaviorPanel}>
          <header><span><p className={styles.eyebrow}>Campanhas de reativação</p><h2>Conversas antigas</h2></span><span className={styles.behaviorState}>{modeLabels[settings?.reactivation_ai_mode ?? "off"]}</span></header>
          <p>Esta configuração é independente do atendimento via WhatsApp e permite produção somente dentro dos gates de campanha.</p>
          <form action={configureReactivationAiAction} className={styles.reactivationForm}>
            <label><span>Como Pedro deve agir</span><select defaultValue={settings?.reactivation_ai_mode ?? "off"} name="reactivationMode"><option value="off">Desligado</option><option value="shadow">Só observa</option><option value="assisted">Sugere para revisão</option><option value="production">Responde automaticamente</option></select></label>
            <label><span>Quem pode receber</span><select defaultValue={settings?.reactivation_release_state ?? "blocked"} name="releaseState"><option value="blocked">Ninguém ainda</option><option value="test_controlled">Somente números de teste</option><option value="released">Todos os contatos elegíveis</option></select></label>
            <label><span>Autonomia</span><select defaultValue={settings?.reactivation_autonomy ?? "low"} name="reactivationAutonomy"><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></label>
            <button type="submit">Salvar reativação</button>
          </form>
        </article>
      </section>

      <div className={styles.grid}>
        <div className={styles.mainColumn}>
          <section className={styles.panel} id="persona">
            <div className={styles.panelHeader}><span><p className={styles.eyebrow}>Persona e estilo</p><h2>{defaultPersona?.name ?? "Pedro"}</h2></span><span className={styles.versionChip}>publicada · v{published?.version}</span></div>
            <p className={styles.panelIntro}>A versão publicada continua atendendo enquanto você prepara e revisa uma nova configuração.</p>
            <details className={styles.advancedEditor} open={!published}>
              <summary>Editar instruções avançadas</summary>
              <form action={createPersonaDraftAction} className={styles.promptForm}>
                <input name="personaId" type="hidden" value={defaultPersona?.id} />
                <label><span>Instruções atuais do Pedro</span><textarea defaultValue={published?.compiled_prompt} name="compiledPrompt" rows={14} required /></label>
                <p>Editar cria uma nova versão em rascunho. Conversas existentes continuam com a versão que já estava ativa.</p>
                <button type="submit">Criar nova versão</button>
              </form>
            </details>
            {drafts.map((draft) => (
              <article className={styles.draftRow} key={draft.id}><span><strong>Rascunho v{draft.version}</strong><small>{draft.checksum.slice(0, 12)}…</small></span>{viewer.membership?.role === "owner" ? <form action={publishPersonaAction}><input name="personaVersionId" type="hidden" value={draft.id} /><button type="submit">Publicar</button></form> : null}</article>
            ))}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}><span><p className={styles.eyebrow}>Construtor guiado</p><h2>Amostras e clones</h2></span><span className={styles.versionChip}>{samplesResult.data?.filter((item)=>item.persona_id===defaultPersona?.id && item.status==='confirmed').length ?? 0} de 10 a 30</span></div>
            <div className={styles.editorChoices}>
              <details className={styles.advancedEditor}>
                <summary>Adicionar conversa de exemplo</summary>
                <form action={addPersonaSampleAction} className={styles.promptForm}>
                  <label><span>Persona</span><select name="personaId" required>{personasResult.data?.map((persona)=><option key={persona.id} value={persona.id}>{persona.name}</option>)}</select></label>
                  <label><span>Conversa de exemplo</span><textarea name="sample" placeholder="Cole uma conversa. Telefones, e-mails, documentos e valores serão mascarados antes da análise." required rows={8}/></label>
                  <p>O original fica protegido somente durante o rascunho e por no máximo 30 dias. Na publicação, permanecem apenas padrões e exemplos anonimizados confirmados.</p>
                  <button type="submit">Mascarar e analisar amostra</button>
                </form>
              </details>
              <details className={styles.advancedEditor}>
                <summary>Clonar persona</summary>
                <form action={clonePersonaAction} className={styles.promptForm}>
                  <input name="sourcePersonaId" type="hidden" value={defaultPersona?.id}/>
                  <label><span>Nome da nova persona</span><input name="name" required/></label>
                  <label><span>Código interno</span><input name="code" pattern="[a-z0-9_]+" placeholder="pedro_investidor" required/></label>
                  <button type="submit">Clonar para novo rascunho</button>
                </form>
              </details>
            </div>
          </section>

          <section className={styles.panel} id="modelos">
            <div className={styles.panelHeader}><span><p className={styles.eyebrow}>Conexão com a IA</p><h2>Chave e modelos</h2></span></div>
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
                  <span className={styles.modelCopy}><strong>{profile.name}</strong><small>{profile.workload_role} · {profile.status === "active" ? "em uso" : "rascunho"}</small></span>
                  <span className={styles.keyState}>{profile.secret_reference ? "chave vinculada" : "sem chave"}</span>
                  <select defaultValue={profile.reasoning_effort ?? "medium"} disabled={profile.status !== "draft"} name="reasoningEffort"><option value="none">none</option><option value="low">low</option><option value="medium">medium</option><option value="high">high</option><option value="xhigh">xhigh</option><option value="max">max</option></select>
                  <select defaultValue={profile.text_verbosity} disabled={profile.status !== "draft"} name="textVerbosity"><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select>
                  {profile.status === "draft" ? <label className={styles.activateCheck}><input name="activate" type="checkbox" /> ativar</label> : <span className={styles.activeLabel}>ativo</span>}
                  {profile.status === "draft" ? <button type="submit">Salvar</button> : null}
                </form>
              ))}
            </div>
            {viewer.membership?.role === "owner" ? <form action={configureFallbackModelAction} className={styles.keyForm}>
              <label><span>Modelo reserva se o principal falhar</span><select defaultValue={settings?.fallback_model_profile_id ?? ""} name="fallbackModelProfileId" required><option value="">Selecione</option>{modelsResult.data?.filter((profile) => profile.secret_reference && !profile.is_default).map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {profile.model_identifier}</option>)}</select></label>
              <button type="submit">Salvar modelo reserva</button>
            </form> : null}
          </section>
        </div>

        <aside className={styles.sideColumn}>
          <section className={styles.panel} id="testes">
            <div className={styles.panelHeader}><span><p className={styles.eyebrow}>Teste controlado</p><h2>Números autorizados para teste</h2></span></div>
            <p className={styles.notice}>A whitelist libera destinatários para o inbound normal em <strong>Responde automaticamente</strong> e para reativação em teste controlado. Adicionar um número não ativa production sozinho.</p>
            <form action={addAiTestNumberAction} className={styles.keyForm}><label><span>Número liberado para teste</span><input name="phoneE164" placeholder="+5511999999999" required /></label><button type="submit">Adicionar</button></form>
            <div className={styles.executionList}>{allowlist?.map((entry) => <article key={entry.id}><span><strong>{entry.phone_e164}</strong><small>Inbound production e reativação controlada</small></span><form action={removeAiTestNumberAction}><input name="allowlistId" type="hidden" value={entry.id} /><button type="submit">Remover</button></form></article>)}{!allowlist?.length ? <p className={styles.notice}>Nenhum número autorizado. O modo automático do inbound permanece oculto.</p> : null}</div>
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
