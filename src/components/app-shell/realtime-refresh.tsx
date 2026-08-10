"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { createClient } from "@/lib/supabase/client";

type RealtimeTable =
  | "messages"
  | "conversations"
  | "ai_suggestions"
  | "conversation_read_states"
  | "alerts"
  | "calls"
  | "call_offers"
  | "campaigns"
  | "campaign_waves"
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
    tables: ["alerts", "calls", "call_offers", "campaigns", "campaign_waves", "messages", "conversations"],
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
    tables: ["messages", "conversations", "calls", "call_offers"],
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
    const channel = supabase.channel(`app-refresh:${orgId}`);
    for (const table of tables) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `org_id=eq.${orgId}` }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (document.visibilityState === "visible") router.refresh();
        }, 300);
      });
    }
    channel.subscribe();
    return () => { clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [orgId, router, tables]);

  return null;
}
