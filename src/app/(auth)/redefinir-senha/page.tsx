import type { Metadata } from "next";

import { ResetForm } from "./reset-form";
import styles from "../auth.module.css";

export const metadata: Metadata = { title: "Redefinir senha" };

export default function ResetPasswordPage() {
  return (
    <div className={styles.formPanel}>
      <header className={styles.formHeader}>
        <h2>Defina uma nova senha</h2>
        <p>Use pelo menos 10 caracteres, com letras e números.</p>
      </header>
      <ResetForm />
    </div>
  );
}
