"use client";

import { useActionState } from "react";

import { initialAuthState } from "@/lib/auth/validation";
import { resetPasswordAction } from "../actions";
import styles from "../auth.module.css";

export function ResetForm() {
  const [state, action, pending] = useActionState(
    resetPasswordAction,
    initialAuthState,
  );

  return (
    <form action={action} className={styles.form} noValidate>
      {state.message ? (
        <p className={styles.feedback} role="alert">{state.message}</p>
      ) : null}

      <div className={styles.field}>
        <label htmlFor="password">Nova senha</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required />
        {state.fields?.password?.map((error) => (
          <p className={styles.fieldError} key={error}>{error}</p>
        ))}
      </div>

      <div className={styles.field}>
        <label htmlFor="confirmPassword">Repita a nova senha</label>
        <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
        {state.fields?.confirmPassword?.map((error) => (
          <p className={styles.fieldError} key={error}>{error}</p>
        ))}
      </div>

      <button className={styles.primaryButton} disabled={pending} type="submit">
        {pending ? "Atualizando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
