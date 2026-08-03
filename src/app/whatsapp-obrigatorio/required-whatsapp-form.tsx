"use client";

import { useActionState } from "react";

import {
  saveRequiredWhatsappAction,
  type RequiredWhatsappState,
} from "./actions";
import styles from "./required-whatsapp.module.css";

const initialState: RequiredWhatsappState = { status: "idle" };

export function RequiredWhatsappForm({ initialWhatsapp }: { initialWhatsapp: string }) {
  const [state, action, pending] = useActionState(saveRequiredWhatsappAction, initialState);

  return (
    <form action={action} className={styles.form} noValidate>
      {state.message ? <p className={styles.error} role="alert">{state.message}</p> : null}
      <label>
        <span>WhatsApp com país e DDD</span>
        <input
          autoComplete="tel"
          defaultValue={initialWhatsapp}
          inputMode="tel"
          name="whatsapp"
          placeholder="+55 11 99999-9999"
          required
        />
      </label>
      {state.fields?.whatsapp?.map((error) => <small key={error}>{error}</small>)}
      <button disabled={pending} type="submit">
        {pending ? "Salvando…" : "Salvar e acessar a operação"}
      </button>
    </form>
  );
}
