"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

const tables = [
  "messages",
  "conversations",
  "ai_suggestions",
  "conversation_read_states",
  "alerts",
  "calls",
  "call_offers",
  "campaigns",
  "campaign_waves",
  "internal_threads",
  "internal_messages",
] as const;

export function RealtimeRefresh({ orgId }: { orgId: string }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase.channel(`app-refresh:${orgId}`);
    for (const table of tables) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `org_id=eq.${orgId}` }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 250);
      });
    }
    channel.subscribe();
    return () => { clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [orgId, router]);

  useEffect(() => {
    if (!["/app/inbox", "/app/chat-pedro", "/app/lionel", "/app/assistente-corretor"].some((route) => pathname.startsWith(route))) return;

    let refreshBlocked = false;
    const refresh = () => {
      if (document.visibilityState !== "visible" || refreshBlocked) return;
      refreshBlocked = true;
      router.refresh();
      window.setTimeout(() => { refreshBlocked = false; }, 1_000);
    };

    const interval = window.setInterval(refresh, 2_500);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pathname, router]);

  return null;
}
