import type { ReactNode } from "react";

import styles from "./ui.module.css";

export function FormField({ children, error, hint, label }: { children: ReactNode; error?: string; hint?: string; label: string }) {
  return (
    <label className={styles.formField}>
      <span>{label}</span>
      {children}
      {error ? <small className={styles.formFieldError}>{error}</small> : hint ? <small>{hint}</small> : null}
    </label>
  );
}
