import Link from "next/link";

import styles from "./ui.module.css";

export function Tabs({
  activeId,
  ariaLabel,
  items,
}: {
  activeId: string;
  ariaLabel: string;
  items: { id: string; label: string; description?: string; href: string }[];
}) {
  return (
    <nav aria-label={ariaLabel} className={styles.tabs}>
      {items.map((item) => (
        <Link aria-current={item.id === activeId ? "page" : undefined} className={item.id === activeId ? styles.tabActive : styles.tab} href={item.href} key={item.id}>
          <span>{item.label}</span>
          {item.description ? <small>{item.description}</small> : null}
        </Link>
      ))}
    </nav>
  );
}
