"use client";

import dynamic from "next/dynamic";

const RealtimeRefresh = dynamic(
  () => import("./realtime-refresh").then((module) => module.RealtimeRefresh),
  { ssr: false },
);

export function RealtimeRefreshLazy({ orgId }: { orgId: string }) {
  return <RealtimeRefresh orgId={orgId} />;
}
