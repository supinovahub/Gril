import type { ReactNode } from "react";

import styles from "./ui.module.css";

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "warning" | "danger" | "accent";
}) {
  return <span className={`${styles.statusBadge} ${styles[`statusBadge${tone[0].toUpperCase()}${tone.slice(1)}`]}`}>{children}</span>;
}
