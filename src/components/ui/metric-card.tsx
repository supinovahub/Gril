import type { ReactNode } from "react";
import Link from "next/link";

import styles from "./ui.module.css";

export function MetricCard({
  label,
  value,
  hint,
  icon,
  href,
  accent = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  href?: string;
  accent?: boolean;
}) {
  const content = (
    <>
      <span className={styles.metricLabel}>{icon}{label}</span>
      <strong className={styles.metricValue}>{value}</strong>
      {hint ? <small className={styles.metricHint}>{hint}</small> : null}
    </>
  );

  return href ? (
    <Link className={`${styles.metricCard}${accent ? ` ${styles.metricCardAccent}` : ""}`} href={href}>
      {content}
    </Link>
  ) : (
    <article className={`${styles.metricCard}${accent ? ` ${styles.metricCardAccent}` : ""}`}>
      {content}
    </article>
  );
}
