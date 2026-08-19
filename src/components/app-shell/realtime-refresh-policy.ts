export type RealtimeTable =
  | "messages"
  | "conversations"
  | "ai_suggestions"
  | "conversation_read_states"
  | "alerts"
  | "escalations"
  | "notifications"
  | "integration_health_checks"
  | "calls"
  | "call_offers"
  | "campaigns"
  | "campaign_waves"
  | "opportunities"
  | "opportunity_scores"
  | "pipeline_stages"
  | "contacts"
  | "contact_phones"
  | "internal_threads"
  | "internal_messages";

export const REALTIME_RECONCILIATION_INTERVAL_MS = 30_000;

const routeTables: Array<{ prefixes: string[]; tables: RealtimeTable[] }> = [
  {
    prefixes: ["/app/inbox"],
    tables: ["messages", "conversations", "ai_suggestions", "conversation_read_states"],
  },
  {
    prefixes: ["/app/chat-pedro", "/app/lionel", "/app/assistente-corretor"],
    tables: ["internal_threads", "internal_messages", "ai_suggestions"],
  },
  {
    prefixes: ["/app/central"],
    tables: ["alerts", "escalations", "notifications", "integration_health_checks", "calls", "campaigns", "internal_threads"],
  },
  {
    prefixes: ["/app/agenda"],
    tables: ["calls", "call_offers"],
  },
  {
    prefixes: ["/app/campanhas"],
    tables: ["campaigns", "campaign_waves"],
  },
  {
    prefixes: ["/app/kanban", "/app/leads", "/app/meu-pipeline", "/app/hoje"],
    tables: ["opportunities", "opportunity_scores", "pipeline_stages", "contacts", "contact_phones", "calls"],
  },
];

export function tablesForPathname(pathname: string) {
  return routeTables.find(({ prefixes }) => prefixes.some((prefix) => pathname.startsWith(prefix)))?.tables ?? [];
}

export function shouldReconcileSubscription(status: string) {
  return status === "SUBSCRIBED";
}

export function shouldReconcileReplication(payload: { extension: string; status: string }) {
  return payload.extension === "system" && payload.status === "ok";
}
