"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";

import { updateProfileAction, type ProfileState } from "./actions";
import styles from "./profile.module.css";

const initialState: ProfileState = { status: "idle" };

export function ProfileForm({
  fullName,
  email,
  whatsapp,
}: {
  fullName: string;
  email: string;
  whatsapp: string;
}) {
  const [state, action, pending] = useActionState(
    updateProfileAction,
    initialState,
  );

  return (
    <form action={action} className={styles.form} noValidate>
      {state.message ? (
        <p
          className={`${styles.feedback} ${state.status === "success" ? styles.success : ""}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}

      <div className={styles.field}>
        <label htmlFor="fullName">Nome completo</label>
        <input id="fullName" name="fullName" defaultValue={fullName} autoComplete="name" />
        {state.fields?.fullName?.map((error) => <small key={error}>{error}</small>)}
      </div>

      <div className={styles.field}>
        <label htmlFor="email">E-mail de acesso</label>
        <input id="email" value={email} disabled readOnly />
        <p>O e-mail é gerenciado pela autenticação e não define permissões.</p>
      </div>

      <div className={styles.field}>
        <label htmlFor="whatsapp">WhatsApp operacional</label>
        <input
          id="whatsapp"
          name="whatsapp"
          defaultValue={whatsapp}
          inputMode="tel"
          placeholder="+55 11 99999-9999"
          autoComplete="tel"
        />
        {state.fields?.whatsapp?.map((error) => <small key={error}>{error}</small>)}
        <p>Usado para comunicação operacional e ofertas de calls; nunca para login.</p>
      </div>

      <div className={styles.formFooter}>
        <button disabled={pending} type="submit">
          <Save size={16} aria-hidden="true" />
          {pending ? "Salvando…" : "Salvar perfil"}
        </button>
      </div>
    </form>
  );
}
