"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useActionState } from "react";

import { initialAuthState } from "@/lib/auth/validation";
import { loginAction } from "../actions";
import styles from "../auth.module.css";

export function LoginForm({
  nextPath,
  pageMessage,
}: {
  nextPath: string;
  pageMessage?: string;
}) {
  const [state, action, pending] = useActionState(loginAction, initialAuthState);

  return (
    <div className={styles.formPanel}>
      <header className={styles.formHeader}>
        <h2>Entre na operação</h2>
        <p>Use o e-mail confirmado da sua conta.</p>
      </header>

      <form action={action} className={styles.form} noValidate>
        <input type="hidden" name="next" value={nextPath} />

        {pageMessage ? (
          <p className={`${styles.feedback} ${styles.feedbackSuccess}`} role="status">
            {pageMessage}
          </p>
        ) : null}

        {state.message ? (
          <p className={styles.feedback} role="alert">
            {state.message}
          </p>
        ) : null}

        <div className={styles.field}>
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@imobiliaria.com.br"
            required
          />
          {state.fields?.email?.map((error) => (
            <p className={styles.fieldError} key={error}>
              {error}
            </p>
          ))}
        </div>

        <div className={styles.field}>
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          {state.fields?.password?.map((error) => (
            <p className={styles.fieldError} key={error}>
              {error}
            </p>
          ))}
        </div>

        <button className={styles.primaryButton} disabled={pending} type="submit">
          {pending ? "Entrando…" : "Entrar"}
          {!pending ? <ArrowRight size={17} aria-hidden="true" /> : null}
        </button>
      </form>

      <div className={styles.linkRow}>
        <Link href="/recuperar-senha">Esqueci minha senha</Link>
        <Link href={`/cadastro?next=${encodeURIComponent(nextPath)}`}>Criar conta</Link>
      </div>
    </div>
  );
}
