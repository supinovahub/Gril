"use client";

import { useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { TYPED_CONFIRMATION_PHRASE } from "@/lib/typed-confirmation";
import styles from "./typed-confirmation-button.module.css";

export function TypedConfirmationButton({
  children,
  className,
  description = "Revise a ação antes de confirmar. Ela será registrada no histórico administrativo.",
  title = "Confirmar ação",
}: {
  children: ReactNode;
  className?: string;
  description?: string;
  title?: string;
}) {
  const confirmationRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [typedValue, setTypedValue] = useState("");
  const { pending } = useFormStatus();
  const titleId = useId();
  const descriptionId = useId();

  function openConfirmation(event: MouseEvent<HTMLButtonElement>) {
    formRef.current = event.currentTarget.form;
    setTypedValue("");
    dialogRef.current?.showModal();
  }

  function cancelConfirmation() {
    dialogRef.current?.close();
  }

  function confirmAndSubmit() {
    if (typedValue !== TYPED_CONFIRMATION_PHRASE) return;
    if (confirmationRef.current) confirmationRef.current.value = typedValue;
    dialogRef.current?.close();
    formRef.current?.requestSubmit();
  }

  return <>
    <input ref={confirmationRef} name="confirmation" type="hidden" />
    <button className={className} disabled={pending} onClick={openConfirmation} type="button">
      {pending ? "Aplicando…" : children}
    </button>
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className={styles.dialog}
      onClick={(event) => {
        if (event.currentTarget === event.target) cancelConfirmation();
      }}
      onClose={() => setTypedValue("")}
      ref={dialogRef}
    >
      <div className={styles.content}>
        <header>
          <p>Ação protegida</p>
          <h2 id={titleId}>{title}</h2>
        </header>
        <p className={styles.description} id={descriptionId}>{description}</p>
        <label>
          <span>Digite exatamente <code>{TYPED_CONFIRMATION_PHRASE}</code></span>
          <input
            autoComplete="off"
            autoFocus
            onChange={(event) => setTypedValue(event.target.value)}
            spellCheck={false}
            value={typedValue}
          />
        </label>
        <footer>
          <button className={styles.cancel} onClick={cancelConfirmation} type="button">Cancelar</button>
          <button
            className={styles.confirm}
            disabled={typedValue !== TYPED_CONFIRMATION_PHRASE}
            onClick={confirmAndSubmit}
            type="button"
          >
            Confirmar ação
          </button>
        </footer>
      </div>
    </dialog>
  </>;
}
