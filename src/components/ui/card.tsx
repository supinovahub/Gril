import type { HTMLAttributes, ReactNode } from "react";

import styles from "./ui.module.css";

export function Card({ children, className, tone = "default", ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode; tone?: "default" | "soft" | "dark" }) {
  return <section className={[styles.card, styles[`card${tone[0].toUpperCase()}${tone.slice(1)}`], className].filter(Boolean).join(" ")} {...props}>{children}</section>;
}
