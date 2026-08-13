"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, FileText, ListChecks, Megaphone, Play, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { createCampaignAction } from "./actions";
import styles from "./campaigns.module.css";

type Connection = { id: string; name: string; phone_e164: string | null; provider: string };
type Template = { id: string; connection_id: string; external_name: string; language: string };
type Variant = { id: string; label: string; template: string };

const steps = [
  { label: "Lista", icon: ListChecks },
  { label: "Mensagem", icon: FileText },
  { label: "IA", icon: Sparkles },
  { label: "Revisão", icon: CheckCircle2 },
  { label: "Disparo", icon: Play },
];

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button className={styles.wizardSubmit} disabled={disabled || pending} type="submit">{pending ? "Criando rascunho…" : "Criar rascunho"}<ArrowRight size={15} /></button>;
}

export function CampaignWizard({
  connections,
  templates,
  variants,
}: {
  connections: Connection[];
  templates: Template[];
  variants: Variant[];
}) {
  const [step, setStep] = useState(0);
  const [connectionId, setConnectionId] = useState(connections[0]?.id ?? "");
  const [name, setName] = useState("");
  const [consentSource, setConsentSource] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [aiMode, setAiMode] = useState("assisted");

  const canAdvance = step === 0 ? Boolean(name.trim() && connectionId && consentSource.trim() && consentConfirmed) : true;
  const selectedConnection = connections.find((connection) => connection.id === connectionId);

  return (
    <form action={createCampaignAction} className={styles.wizard}>
      <header className={styles.wizardHeader}>
        <div><p className={styles.eyebrow}>Nova campanha</p><h2>Preparar reativação</h2><p>Uma sequência clara para escolher a base, revisar a mensagem e liberar o disparo com segurança.</p></div>
        <span className={styles.wizardIcon}><Megaphone size={19} /></span>
      </header>

      <ol className={styles.wizardProgress} aria-label="Etapas da campanha">
        {steps.map((item, index) => {
          const Icon = item.icon;
          return <li className={index === step ? styles.wizardStepActive : index < step ? styles.wizardStepDone : styles.wizardStep} key={item.label}><span><Icon size={14} /></span><small>{index + 1}</small>{item.label}</li>;
        })}
      </ol>

      <fieldset className={styles.wizardStepPanel} hidden={step !== 0}>
        <legend>1. Selecione a lista</legend>
        <p className={styles.wizardLead}>Comece nomeando a reativação e escolhendo o número que vai conversar com a base.</p>
        <label><span>Nome da campanha</span><input name="name" onChange={(event) => setName(event.target.value)} required value={name} placeholder="Ex.: Leads de julho — investimento" /></label>
        <label><span>Conexão WhatsApp</span><select name="connectionId" onChange={(event) => setConnectionId(event.target.value)} required value={connectionId}><option value="">Selecione uma conexão</option>{connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name} · {connection.phone_e164 ?? connection.provider}</option>)}</select></label>
        <div className={styles.listHint}><ListChecks size={17} /><span><strong>A base entra depois do rascunho</strong><small>Ao criar, você poderá importar CSV, conferir duplicados e validar os contatos antes de liberar qualquer onda.</small></span></div>
        <label><span>Origem autorizada da base</span><input name="consentSource" onChange={(event) => setConsentSource(event.target.value)} required value={consentSource} placeholder="CRM próprio, evento, formulário…" /></label>
        <label className={styles.check}><input checked={consentConfirmed} name="consentConfirmed" onChange={(event) => setConsentConfirmed(event.target.checked)} required type="checkbox" /> Confirmo que a base possui autorização válida para contato comercial via WhatsApp.</label>
        <input name="consentStatement" type="hidden" value="Confirmo que esta base possui autorização válida para contato comercial via WhatsApp." />
      </fieldset>

      <fieldset className={styles.wizardStepPanel} hidden={step !== 1}>
        <legend>2. Defina a mensagem</legend>
        <p className={styles.wizardLead}>As três aberturas perseguem o mesmo objetivo e alternam de forma controlada entre os contatos elegíveis.</p>
        {variants.map((variant, index) => <label key={variant.id}><span>Variação {index + 1} · {variant.label}</span><textarea defaultValue={variant.template} name={`openingVariant${index + 1}`} required rows={4} /><small>Você pode usar nome, objetivo, entrada, parcela, orçamento e histórico da base.</small></label>)}
        <label><span>Template Meta aprovado <em>opcional para Uazapi</em></span><select defaultValue="" name="messageTemplateId"><option value="">Não se aplica (Uazapi)</option>{templates.filter((template) => template.connection_id === connectionId).map((template) => <option key={template.id} value={template.id}>{template.external_name} · {template.language}</option>)}</select><small>{selectedConnection?.provider === "meta" ? "A conexão Meta exige um template aprovado." : "Para Uazapi, a abertura livre continua disponível."}</small></label>
      </fieldset>

      <fieldset className={styles.wizardStepPanel} hidden={step !== 2}>
        <legend>3. Configure a IA</legend>
        <p className={styles.wizardLead}>Escolha quanto Pedro participa desta reativação. O atendimento normal continua separado.</p>
        <div className={styles.modeChoices}>
          {[["off", "Desligado", "A campanha envia somente a mensagem definida."], ["shadow", "Observa", "Pedro analisa a resposta, sem sugerir ou enviar."], ["assisted", "Revisa", "Pedro sugere o próximo passo para a equipe."], ["production", "Produção", "Pedro pode agir quando a reativação estiver liberada."]].map(([value, label, description]) => <label className={aiMode === value ? styles.modeChoiceActive : styles.modeChoice} key={value}><input checked={aiMode === value} name="aiMode" onChange={() => setAiMode(value)} type="radio" value={value} /><span><strong>{label}</strong><small>{description}</small></span></label>)}
        </div>
        <div className={styles.wizardNotice}><ShieldCheck size={16} /><span>Produção só será aceita pelo backend quando os gates de reativação estiverem aprovados.</span></div>
      </fieldset>

      <fieldset className={styles.wizardStepPanel} hidden={step !== 3}>
        <legend>4. Revise antes de criar</legend>
        <p className={styles.wizardLead}>Confira o resumo. Criar o rascunho não envia mensagens nem libera uma onda.</p>
        <dl className={styles.reviewSummary}><div><dt>Campanha</dt><dd>{name || "Ainda não informado"}</dd></div><div><dt>Conexão</dt><dd>{selectedConnection?.name || "Ainda não selecionada"}</dd></div><div><dt>IA</dt><dd>{aiMode === "assisted" ? "Sugere para revisão" : aiMode === "shadow" ? "Só observa" : aiMode === "production" ? "Produção" : "Desligada"}</dd></div><div><dt>Base</dt><dd>{consentSource || "Ainda não informada"}</dd></div></dl>
        <div className={styles.wizardNotice}><ShieldCheck size={16} /><span>Depois de criar, importe a base, revise a amostra e libere ondas de 20, 50 e restante explicitamente.</span></div>
      </fieldset>

      <fieldset className={styles.wizardStepPanel} hidden={step !== 4}>
        <legend>5. Dispare quando estiver pronto</legend>
        <p className={styles.wizardLead}>O primeiro passo desta etapa cria apenas um rascunho. O disparo só acontece depois da importação, aprovação e liberação da onda.</p>
        <div className={styles.dispatchChecklist}><p><CheckCircle2 size={16} /> A base pode ser revisada depois da criação</p><p><CheckCircle2 size={16} /> O opt-out e duplicados são revalidados pelo backend</p><p><CheckCircle2 size={16} /> Cada onda precisa de uma liberação explícita</p></div>
      </fieldset>

      <footer className={styles.wizardFooter}>
        {step > 0 ? <button className={styles.wizardBack} onClick={() => setStep((current) => current - 1)} type="button"><ArrowLeft size={15} /> Voltar</button> : <span />}
        {step < steps.length - 1 ? <button className={styles.wizardNext} disabled={!canAdvance} onClick={() => setStep((current) => current + 1)} type="button">Continuar <ArrowRight size={15} /></button> : <SubmitButton disabled={!canAdvance || !connections.length} />}
      </footer>
    </form>
  );
}

