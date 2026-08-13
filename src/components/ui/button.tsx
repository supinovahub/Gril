import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

import styles from "./ui.module.css";

type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
type ButtonSize = "sm" | "md" | "lg";

function buttonClassName(variant: ButtonVariant, size: ButtonSize, className?: string) {
  return [styles.button, styles[`button${variant[0].toUpperCase()}${variant.slice(1)}`], styles[`button${size[0].toUpperCase()}${size.slice(1)}`], className]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  children,
  className,
  size = "md",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  return <button className={buttonClassName(variant, size, className)} {...props}>{children}</button>;
}

export function ButtonLink({
  children,
  className,
  href,
  size = "md",
  variant = "primary",
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  href: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  return <Link className={buttonClassName(variant, size, className)} href={href} {...props}>{children}</Link>;
}
