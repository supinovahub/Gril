"use client";

import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo } from "react";

import { createClient } from "@/lib/supabase/client";

type RealtimeTable =
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

function tablesForPathname(pathname: string) {
  return routeTables.find(({ prefixes }) => prefixes.some((prefix) => pathname.startsWith(prefix)))?.tables ?? [];
}

export function RealtimeRefresh({ orgId }: { orgId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const tables = useMemo(() => tablesForPathname(pathname), [pathname]);

  useEffect(() => {
    if (tables.length === 0) return;

    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pendingWhileHidden = false;
    const refresh = () => {
      if (document.visibilityState !== "visible") {
        pendingWhileHidden = true;
        return;
      }
      pendingWhileHidden = false;
      startTransition(() => router.refresh());
    };
    const scheduleRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 800);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && pendingWhileHidden) scheduleRefresh();
    };
    const channel = supabase.channel(`app-refresh:${orgId}:${pathname}`);
    for (const table of tables) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `org_id=eq.${orgId}` }, () => {
        scheduleRefresh();
      });
    }
    channel.subscribe();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
      void supabase.removeChannel(channel);
    };
  }, [orgId, pathname, router, tables]);

  return null;
}
