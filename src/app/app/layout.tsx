import { AppShell } from "@/components/app-shell/app-shell";
import { requireActiveViewer } from "@/lib/auth/session";
import { loadInboxNotificationCounts } from "@/lib/inbox/notifications";
import { loadInternalChatNotifications } from "@/lib/internal-chat/notifications";
import { createClient } from "@/lib/supabase/server";

export default async function ApplicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const [notifications, internalNotifications] = await Promise.all([
    loadInboxNotificationCounts(supabase, viewer.organization!.id),
    loadInternalChatNotifications(supabase, viewer.organization!.id, viewer.userId),
  ]);

  return (
    <AppShell
      inboxNotificationCount={notifications.conversationsWithNotifications}
      internalChatNotificationCounts={internalNotifications}
      viewer={viewer}
    >
      {children}
    </AppShell>
  );
}
