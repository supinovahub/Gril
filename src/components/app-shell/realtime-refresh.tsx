"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

const tables = ["messages", "conversations", "alerts", "calls", "call_offers", "campaigns", "campaign_waves"] as const;

export function RealtimeRefresh({ orgId }: { orgId: string }) {
  const router = useRouter();
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
  return null;
}
