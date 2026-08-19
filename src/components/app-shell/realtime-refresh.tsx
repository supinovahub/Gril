"use client";

import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo } from "react";

import { createClient } from "@/lib/supabase/client";
import {
  REALTIME_RECONCILIATION_INTERVAL_MS,
  shouldReconcileReplication,
  shouldReconcileSubscription,
  tablesForPathname,
} from "./realtime-refresh-policy";

export function RealtimeRefresh({ orgId }: { orgId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const tables = useMemo(() => tablesForPathname(pathname), [pathname]);

  useEffect(() => {
    if (tables.length === 0) return;

    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      startTransition(() => router.refresh());
    };
    const scheduleRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 800);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };
    const channel = supabase.channel(`app-refresh:${orgId}:${pathname}`, {
      config: { broadcast: { replication_ready: true } },
    });
    for (const table of tables) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `org_id=eq.${orgId}` }, () => {
        scheduleRefresh();
      });
    }
    channel.on("system", {}, (payload) => {
      if (shouldReconcileReplication(payload)) scheduleRefresh();
    });
    channel.subscribe((status) => {
      if (shouldReconcileSubscription(status)) scheduleRefresh();
    });
    const reconciliationInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") scheduleRefresh();
    }, REALTIME_RECONCILIATION_INTERVAL_MS);
    window.addEventListener("focus", scheduleRefresh);
    window.addEventListener("online", scheduleRefresh);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearTimeout(timer);
      window.clearInterval(reconciliationInterval);
      window.removeEventListener("focus", scheduleRefresh);
      window.removeEventListener("online", scheduleRefresh);
      document.removeEventListener("visibilitychange", handleVisibility);
      void supabase.removeChannel(channel);
    };
  }, [orgId, pathname, router, tables]);

  return null;
}
