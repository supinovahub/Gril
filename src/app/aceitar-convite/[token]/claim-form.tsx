"use client";

import { ArrowRight } from "lucide-react";
import { useActionState } from "react";

import { claimInvitationAction, type ClaimState } from "./actions";
import styles from "./invite.module.css";

const initialState: ClaimState = { status: "idle" };

export function ClaimForm({
  initialWhatsapp,
  token,
}: {
  initialWhatsapp: string;
  token: string;
}) {
  const action = claimInvitationAction.bind(null, token);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={styles.claimForm} noValidate>
      {state.message ? <p className={styles.error} role="alert">{state.message}</p> : null}
      <label className={styles.field}>
        <span>WhatsApp operacional obrigatório</span>
        <input
          autoComplete="tel"
          defaultValue={initialWhatsapp}
          inputMode="tel"
          name="whatsapp"
          placeholder="+55 11 99999-9999"
          required
        />
        <small>Use país, DDD e número. Este número não pode pertencer a outra conta.</small>
      </label>
      {state.fields?.whatsapp?.map((error) => <p className={styles.fieldError} key={error}>{error}</p>)}
      <button className={styles.primaryButton} disabled={pending} type="submit">
        {pending ? "Salvando e validando…" : "Salvar WhatsApp e aceitar convite"}
        {!pending ? <ArrowRight size={17} aria-hidden="true" /> : null}
      </button>
    </form>
  );
}
