"use client";

import { Building2, ChevronDown, SlidersHorizontal, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import styles from "./app-shell.module.css";

const groupIcons = {
  administration: Building2,
  intelligence: Sparkles,
  management: SlidersHorizontal,
};

export function NavGroup({
  activePrefixes,
  children,
  kind,
  label,
}: {
  activePrefixes: string[];
  children: ReactNode;
  kind: keyof typeof groupIcons;
  label: string;
}) {
  const pathname = usePathname();
  const active = activePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const [expanded, setExpanded] = useState(false);
  const Icon = groupIcons[kind];

  return (
    <details
      className={`${styles.navGroup}${active ? ` ${styles.navGroupActive}` : ""}`}
      onToggle={(event) => {
        if (!active) setExpanded(event.currentTarget.open);
      }}
      open={active || expanded}
    >
      <summary>
        <span><Icon aria-hidden="true" size={16} />{label}</span>
        <ChevronDown aria-hidden="true" className={styles.navGroupChevron} size={14} />
      </summary>
      <div className={styles.navGroupLinks}>{children}</div>
    </details>
  );
}
