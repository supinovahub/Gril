"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { TypedConfirmationButton } from "@/components/typed-confirmation-button";
import {
  loadHomologationPreviewAction,
  purgeHomologationContextAction,
  type HomologationPreview,
} from "./homologation-actions";
import styles from "./dashboard.module.css";

type PreviewState =
  | { status: "idle" | "loading" }
  | { status: "ready"; preview: HomologationPreview }
  | { status: "error" };

export function HomologationCleanupPanel() {
  const [state, setState] = useState<PreviewState>({ status: "idle" });

  async function loadPreviewOnOpen(event: React.SyntheticEvent<HTMLDetailsElement>) {
    if (!event.currentTarget.open || state.status !== "idle") return;

    setState({ status: "loading" });
    const preview = await loadHomologationPreviewAction();
    setState(preview ? { preview, status: "ready" } : { status: "error" });
  }

  return (
    <details className={styles.adminDisclosure} onToggle={loadPreviewOnOpen}>
      <summary>
        <span>Área administrativa</span>
        <ChevronDown aria-hidden="true" size={15} />
      </summary>
      <section className={styles.cleanupPanel} aria-labelledby="homologation-cleanup-title">
        <div className={styles.cleanupIntro}>
          <h2 id="homologation-cleanup-title">Limpar contexto de homologação</h2>
          <p>Remove somente registros de teste com prefixo <code>HML-</code> desta imobiliária. Configurações, equipe e auditoria ficam preservadas.</p>
        </div>

        {state.status === "idle" || state.status === "loading" ? (
          <p className={styles.cleanupEmpty}>Carregando preview seguro...</p>
        ) : null}

        {state.status === "error" ? (
          <p className={styles.cleanupEmpty}>Não foi possível carregar o preview. A ação permanece indisponível.</p>
        ) : null}

        {state.status === "ready" ? (
          <div className={styles.cleanupBody}>
            <dl className={styles.cleanupCounts}>
              <div><dt>Contatos</dt><dd>{state.preview.counts.contacts ?? 0}</dd></div>
              <div><dt>Oportunidades</dt><dd>{state.preview.counts.opportunities ?? 0}</dd></div>
              <div><dt>Conversas</dt><dd>{state.preview.counts.conversations ?? 0}</dd></div>
              <div><dt>Mensagens</dt><dd>{state.preview.counts.messages ?? 0}</dd></div>
              <div><dt>Chamadas</dt><dd>{state.preview.counts.calls ?? 0}</dd></div>
              <div><dt>Jobs</dt><dd>{state.preview.counts.scheduled_jobs ?? 0}</dd></div>
            </dl>
            {state.preview.blocked?.length ? (
              <div className={styles.cleanupBlocked}>
                <strong>Limpeza bloqueada por segurança</strong>
                <ul>{state.preview.blocked.map((reason) => <li key={reason}>{reason}</li>)}</ul>
              </div>
            ) : state.preview.eligible ? (
              <form action={purgeHomologationContextAction} className={styles.cleanupAction}>
                <p>A execução é limitada a 20 contatos e exige a confirmação literal protegida.</p>
                <TypedConfirmationButton description="Somente registros HML- desta imobiliária serão removidos. Configurações, equipe e auditoria serão preservadas." title="Limpar contexto de homologação">Limpar contexto HML-</TypedConfirmationButton>
              </form>
            ) : (
              <p className={styles.cleanupEmpty}>Nenhum registro HML- elegível para limpar.</p>
            )}
          </div>
        ) : null}
      </section>
    </details>
  );
}
