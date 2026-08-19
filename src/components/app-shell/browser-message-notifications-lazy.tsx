"use client";

import dynamic from "next/dynamic";

const BrowserMessageNotifications = dynamic(
  () => import("./browser-message-notifications").then((module) => module.BrowserMessageNotifications),
  { ssr: false },
);

export function BrowserMessageNotificationsLazy({ orgId }: { orgId: string }) {
  return <BrowserMessageNotifications orgId={orgId} />;
}
