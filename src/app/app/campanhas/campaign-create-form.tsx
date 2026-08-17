"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Megaphone } from "lucide-react";

import { createCampaignAction } from "./actions";
import styles from "./campaigns.module.css";

type ConnectionOption = {
  id: string;
  name: string;
  phone_e164: string | null;
  provider: string;
};

type TemplateOption = {
  id: string;
  connection_id: string;
  external_name: string;
  language: string;
};

type MessageVariant = {
  id: string;
  label: string;
  template: string;
};

const steps = [
  { label: "Campanha", description: "Nome e canal" },
  { label: "Automação", description: "Modo e template" },
  { label: "Mensagens", description: "Aberturas da conversa" },
  { label: "Consentimento", description: "Origem e confirmação" },
];

export function CampaignCreateForm({
  connections,
  templates,
  variants,
}: {
  connections: ConnectionOption[];
  templates: TemplateOption[];
  variants: MessageVariant[];
}) {
  const [activeStep, setActiveStep] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  function goToStep(nextStep: number) {
    setActiveStep(Math.min(Math.max(nextStep, 0), steps.length - 1));
  }

  function advance() {
    const currentPanel = formRef.current?.querySelector<HTMLElement>(`[data-campaign-step="${activeStep}"]`);
    const controls = currentPanel?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      "input, select, textarea",
    );
    const invalidControl = Array.from(controls ?? []).find((control) => !control.checkValidity());
    if (invalidControl) {
      invalidControl.reportValidity();
      return;
    }
    goToStep(activeStep + 1);
  }

  function revealInvalidStep(event: React.InvalidEvent<HTMLFormElement>) {
    if (!(event.target instanceof HTMLElement)) return;
    const panel = event.target.closest<HTMLElement>("[data-campaign-step]");
    const step = Number(panel?.dataset.campaignStep);
    if (Number.isInteger(step)) setActiveStep(step);
  }

  return (
    <form
      action={createCampaignAction}
      className={styles.createForm}
      onInvalidCapture={revealInvalidStep}
      ref={formRef}
    >
      <div className={styles.createIntro}>
        <span className={styles.createIcon}><Megaphone aria-hidden="true" size={18} /></span>
        <span>
          <strong>Preparar reativação</strong>
          <small>O envio só começa depois da revisão da base e da liberação da primeira onda.</small>
        </span>
      </div>

      <ol className={styles.stepNavigation} aria-label="Etapas da nova campanha">
        {steps.map((step, index) => (
          <li key={step.label}>
            <button
              aria-current={activeStep === index ? "step" : undefined}
              className={activeStep === index ? styles.stepActive : styles.stepButton}
              onClick={() => goToStep(index)}
              type="button"
            >
              <span>{index < activeStep ? <Check aria-hidden="true" size={14} /> : index + 1}</span>
              <span><strong>{step.label}</strong><small>{step.description}</small></span>
            </button>
          </li>
        ))}
      </ol>

      <div className={styles.stepPanel} data-campaign-step="0" hidden={activeStep !== 0}>
        <div className={styles.stepHeading}>
          <h2>Identifique a campanha</h2>
          <p>Escolha um nome reconhecível e o número que fará o primeiro contato.</p>
        </div>
        <div className={styles.formGrid}>
          <label>
            <span>Nome da campanha</span>
            <input name="name" placeholder="Ex.: Base de investidores - agosto" required />
          </label>
          <label>
            <span>Conexão ativa</span>
            <select name="connectionId" required>
              <option value="">Selecione um número</option>
              {connections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.name} - {connection.phone_e164 ?? connection.provider}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className={styles.stepPanel} data-campaign-step="1" hidden={activeStep !== 1}>
        <div className={styles.stepHeading}>
          <h2>Defina a automação</h2>
          <p>O modo controla o que a IA pode fazer somente nesta campanha.</p>
        </div>
        <div className={styles.formGrid}>
          <label>
            <span>Automação da campanha</span>
            <select name="aiMode">
              <option value="off">Desligada</option>
              <option value="shadow">Somente observar</option>
              <option value="assisted">Sugerir para revisão</option>
              <option value="production">Responder automaticamente</option>
            </select>
          </label>
          <label>
            <span>Template Meta aprovado</span>
            <select name="messageTemplateId">
              <option value="">Não se aplica (Uazapi)</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.external_name} - {template.language}
                </option>
              ))}
            </select>
            <small>Obrigatório apenas quando a conexão usa a API oficial da Meta.</small>
          </label>
        </div>
      </div>

      <div className={styles.stepPanel} data-campaign-step="2" hidden={activeStep !== 2}>
        <div className={styles.stepHeading}>
          <h2>Revise as mensagens</h2>
          <p>As variações alternam a abertura, mantendo o mesmo objetivo comercial.</p>
        </div>
        <div className={styles.variantList}>
          {variants.map((variant, index) => (
            <label key={variant.id}>
              <span>{variant.label}</span>
              <textarea name={`openingVariant${index + 1}`} defaultValue={variant.template} rows={4} />
              <small>Campos da planilha podem usar {"{{first_name}}"}, {"{{objetivo}}"}, {"{{orcamento}}"} e {"{{historico}}"}.</small>
            </label>
          ))}
        </div>
      </div>

      <div className={styles.stepPanel} data-campaign-step="3" hidden={activeStep !== 3}>
        <div className={styles.stepHeading}>
          <h2>Confirme a origem da base</h2>
          <p>Registre por que estes contatos podem receber uma comunicação comercial.</p>
        </div>
        <div className={styles.formGrid}>
          <label className={styles.fullField}>
            <span>Declaração de consentimento</span>
            <textarea
              name="consentStatement"
              defaultValue="Confirmo que esta base possui autorização válida para contato comercial via WhatsApp."
              rows={3}
            />
          </label>
          <label className={styles.fullField}>
            <span>Origem da base</span>
            <input name="consentSource" placeholder="CRM próprio, evento ou formulário" />
          </label>
          <label className={`${styles.check} ${styles.fullField}`}>
            <input name="consentConfirmed" required type="checkbox" />
            <span>Confirmo a declaração e a origem informadas acima.</span>
          </label>
        </div>
      </div>

      <div className={styles.wizardActions}>
        <button
          className={styles.secondaryButton}
          disabled={activeStep === 0}
          onClick={() => goToStep(activeStep - 1)}
          type="button"
        >
          <ArrowLeft aria-hidden="true" size={15} /> Voltar
        </button>
        {activeStep < steps.length - 1 ? (
          <button className={styles.primaryButton} onClick={advance} type="button">
            Continuar <ArrowRight aria-hidden="true" size={15} />
          </button>
        ) : (
          <button className={styles.primaryButton} disabled={!connections.length} type="submit">
            Criar rascunho <ArrowRight aria-hidden="true" size={15} />
          </button>
        )}
      </div>
    </form>
  );
}
