"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";

const confirmationPhrase = "CONFIRMAR AÇÃO";

export function TypedConfirmationButton({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const confirmationRef = useRef<HTMLInputElement>(null);

  function confirmAndSubmit(event: MouseEvent<HTMLButtonElement>) {
    const value = window.prompt(`Digite exatamente “${confirmationPhrase}” para continuar.`);
    if (value !== confirmationPhrase) return;
    if (confirmationRef.current) confirmationRef.current.value = value;
    event.currentTarget.form?.requestSubmit();
  }

  return <>
    <input ref={confirmationRef} name="confirmation" type="hidden" />
    <button className={className} onClick={confirmAndSubmit} type="button">{children}</button>
  </>;
}
