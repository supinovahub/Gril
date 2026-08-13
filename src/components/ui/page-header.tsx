import type { ReactNode } from "react";

import styles from "./ui.module.css";

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader} data-ui="page-header">
      <div>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
      {children ? <div className={styles.headerActions}>{children}</div> : null}
    </header>
  );
}
