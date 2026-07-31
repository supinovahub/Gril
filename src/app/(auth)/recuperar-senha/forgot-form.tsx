"use client";

import { useActionState } from "react";

import { initialAuthState } from "@/lib/auth/validation";
import { forgotPasswordAction } from "../actions";
import styles from "../auth.module.css";

export function ForgotForm() {
  const [state, action, pending] = useActionState(
    forgotPasswordAction,
    initialAuthState,
  );

  return (
    <form action={action} className={styles.form} noValidate>
      {state.message ? (
        <p
          className={`${styles.feedback} ${
            state.status === "success" ? styles.feedbackSuccess : ""
          }`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}

      <div className={styles.field}>
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
        {state.fields?.email?.map((error) => (
          <p className={styles.fieldError} key={error}>{error}</p>
        ))}
      </div>

      <button className={styles.primaryButton} disabled={pending} type="submit">
        {pending ? "Enviando…" : "Enviar link de recuperação"}
      </button>
    </form>
  );
}
