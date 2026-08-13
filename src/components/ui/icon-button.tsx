import type { ButtonHTMLAttributes, ReactNode } from "react";

import styles from "./ui.module.css";

export function IconButton({
  children,
  label,
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  label: string;
  size?: "sm" | "md";
}) {
  return <button aria-label={label} className={`${styles.iconButton} ${styles[`iconButton${size[0].toUpperCase()}${size.slice(1)}`]}`} {...props}>{children}</button>;
}
