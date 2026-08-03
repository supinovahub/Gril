"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useActionState } from "react";

import { initialAuthState } from "@/lib/auth/validation";
import { registerAction } from "../actions";
import styles from "../auth.module.css";

export function RegisterForm({ nextPath, initialEmail }: { nextPath: string; initialEmail?: string }) {
  const [state, action, pending] = useActionState(registerAction, initialAuthState);

  return (
    <div className={styles.formPanel}>
      <Link className={styles.backLink} href={`/login?next=${encodeURIComponent(nextPath)}`}>
        ← Já tenho conta
      </Link>

      <header className={styles.formHeader}>
        <h2>Crie sua conta</h2>
        <p>O acesso aos dados só é liberado após convite ou aprovação.</p>
      </header>

      <form action={action} className={styles.form} noValidate>
        <input type="hidden" name="next" value={nextPath} />

        {state.message ? (
          <p
            className={`${styles.feedback} ${
              state.status === "success" ? styles.feedbackSuccess : ""
            }`}
            role={state.status === "success" ? "status" : "alert"}
          >
            {state.message}
          </p>
        ) : null}

        <div className={styles.field}>
          <label htmlFor="fullName">Nome completo</label>
          <input
            id="fullName"
            name="fullName"
            autoComplete="name"
            placeholder="Seu nome"
            required
          />
          {state.fields?.fullName?.map((error) => (
            <p className={styles.fieldError} key={error}>{error}</p>
          ))}
        </div>

        <div className={styles.field}>
          <label htmlFor="email">E-mail</label>
          <input
            defaultValue={initialEmail}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@imobiliaria.com.br"
            required
          />
          {state.fields?.email?.map((error) => (
            <p className={styles.fieldError} key={error}>{error}</p>
          ))}
        </div>

        <div className={styles.field}>
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="10+ caracteres, letras e números"
            required
          />
          {state.fields?.password?.map((error) => (
            <p className={styles.fieldError} key={error}>{error}</p>
          ))}
        </div>

        <button className={styles.primaryButton} disabled={pending} type="submit">
          {pending ? "Criando…" : "Criar conta"}
          {!pending ? <ArrowRight size={17} aria-hidden="true" /> : null}
        </button>
      </form>
    </div>
  );
}
