import type { ReactNode } from "react";

import styles from "./ui.module.css";

export function EmptyState({ action, description, icon, title }: { action?: ReactNode; description: string; icon?: ReactNode; title: string }) {
  return (
    <div className={styles.emptyState}>
      {icon ? <span className={styles.emptyStateIcon}>{icon}</span> : null}
      <strong>{title}</strong>
      <span>{description}</span>
      {action ? <div className={styles.emptyStateAction}>{action}</div> : null}
    </div>
  );
}
