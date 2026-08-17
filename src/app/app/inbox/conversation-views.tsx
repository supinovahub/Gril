import { ContactRound, MessagesSquare } from "lucide-react";
import { IntentPrefetchLink as Link } from "@/components/navigation/intent-prefetch-link";

import styles from "./inbox.module.css";

export function ConversationViews({ active }: { active: "conversations" | "leads" }) {
  return (
    <nav aria-label="Visualizações de Conversas" className={styles.workspaceViews}>
      <Link
        aria-current={active === "conversations" ? "page" : undefined}
        className={active === "conversations" ? styles.workspaceViewActive : styles.workspaceView}
        href="/app/inbox"
        prefetch={false}
      >
        <MessagesSquare aria-hidden="true" size={15} /> Conversas
      </Link>
      <Link
        aria-current={active === "leads" ? "page" : undefined}
        className={active === "leads" ? styles.workspaceViewActive : styles.workspaceView}
        href="/app/leads"
        prefetch={false}
      >
        <ContactRound aria-hidden="true" size={15} /> Leads
      </Link>
    </nav>
  );
}
