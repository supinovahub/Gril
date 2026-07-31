import type { Metadata } from "next";
import Link from "next/link";

import { ForgotForm } from "./forgot-form";
import styles from "../auth.module.css";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <div className={styles.formPanel}>
      <Link className={styles.backLink} href="/login">← Voltar para entrar</Link>
      <header className={styles.formHeader}>
        <h2>Recupere sua senha</h2>
        <p>Enviaremos um link para o e-mail da conta.</p>
      </header>
      <ForgotForm />
    </div>
  );
}
