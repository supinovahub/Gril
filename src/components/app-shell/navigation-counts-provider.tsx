"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { NotificationBadge } from "@/components/notification-badge/notification-badge";
import type { WorkspaceNavigationCounts } from "@/lib/navigation/counts";
import styles from "./app-shell.module.css";
import {
  formatBrowserTabTitle,
  NAVIGATION_COUNTS_REFRESH_EVENT,
  stripBrowserTabCount,
} from "./browser-message-notification-policy";

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
  const pathname = usePathname();
  const inboxCountRef = useRef(0);
  const baseTitleRef = useRef("Pedro | Operação imobiliária");

  useEffect(() => {
    const controller = new AbortController();
    let latestRequest = 0;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      const request = ++latestRequest;
      void fetchNavigationCounts(controller.signal)
        .then((nextCounts) => {
          if (request === latestRequest) setCounts(nextCounts);
        })
        .catch((error: unknown) => {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            console.error("Failed to refresh navigation counts", error);
          }
        });
    };
    const scheduleRefresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(refresh, 150);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    refresh();
    const interval = window.setInterval(refreshWhenVisible, 30_000);
    window.addEventListener("focus", refresh);
    window.addEventListener(NAVIGATION_COUNTS_REFRESH_EVENT, scheduleRefresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      controller.abort();
      clearTimeout(refreshTimer);
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(NAVIGATION_COUNTS_REFRESH_EVENT, scheduleRefresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    inboxCountRef.current = counts.inbox;
    const currentBaseTitle = stripBrowserTabCount(document.title);
    if (currentBaseTitle) baseTitleRef.current = currentBaseTitle;
    document.title = formatBrowserTabTitle(baseTitleRef.current, counts.inbox);
  }, [counts.inbox, pathname]);

  useEffect(() => {
    const syncTitle = () => {
      const currentBaseTitle = stripBrowserTabCount(document.title);
      if (currentBaseTitle) baseTitleRef.current = currentBaseTitle;

      const nextTitle = formatBrowserTabTitle(baseTitleRef.current, inboxCountRef.current);
      if (document.title !== nextTitle) document.title = nextTitle;
    };
    const observer = new MutationObserver(syncTitle);

    syncTitle();
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      document.title = stripBrowserTabCount(document.title);
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
