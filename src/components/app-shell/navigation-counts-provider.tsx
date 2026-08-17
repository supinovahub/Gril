"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { NotificationBadge } from "@/components/notification-badge/notification-badge";
import type { WorkspaceNavigationCounts } from "@/lib/navigation/counts";
import styles from "./app-shell.module.css";

const emptyCounts: WorkspaceNavigationCounts = {
  inbox: 0,
  pedro: 0,
  lionel: 0,
  broker: 0,
};

const NavigationCountsContext = createContext<WorkspaceNavigationCounts>(emptyCounts);

async function fetchNavigationCounts(signal?: AbortSignal) {
  const response = await fetch("/api/workspace/navigation-counts", {
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) throw new Error(`navigation_counts_${response.status}`);
  return response.json() as Promise<WorkspaceNavigationCounts>;
}

export function NavigationCountsProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState(emptyCounts);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      void fetchNavigationCounts(controller.signal)
        .then(setCounts)
        .catch((error: unknown) => {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            console.error("Failed to refresh navigation counts", error);
          }
        });
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    refresh();
    const interval = window.setInterval(refreshWhenVisible, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  return <NavigationCountsContext.Provider value={counts}>{children}</NavigationCountsContext.Provider>;
}

export function NavigationCountBadge({
  kind,
  mobile,
}: {
  kind: "broker" | "central" | "inbox";
  mobile?: boolean;
}) {
  const counts = useContext(NavigationCountsContext);
  const count = kind === "central" ? counts.pedro + counts.lionel : counts[kind];
  const label = kind === "inbox"
    ? `${count} ${count === 1 ? "conversa com notificação" : "conversas com notificações"}`
    : kind === "broker"
      ? `${count} consultas pendentes`
      : `${count} registros internos pendentes`;

  return (
    <NotificationBadge
      className={mobile ? styles.mobileNotificationBadge : styles.navNotificationBadge}
      count={count}
      label={label}
    />
  );
}
