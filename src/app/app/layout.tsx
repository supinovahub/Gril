import { AppShell } from "@/components/app-shell/app-shell";
import { requireActiveViewer } from "@/lib/auth/session";
import { loadInboxNotificationCounts } from "@/lib/inbox/notifications";
import { createClient } from "@/lib/supabase/server";

export default async function ApplicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const notifications = await loadInboxNotificationCounts(supabase, viewer.organization!.id);

  return (
    <AppShell
      inboxNotificationCount={notifications.conversationsWithNotifications}
      viewer={viewer}
    >
      {children}
    </AppShell>
  );
}
