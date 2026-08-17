import { AppShell } from "@/components/app-shell/app-shell";
import { requireActiveViewer } from "@/lib/auth/session";
import { getWorkspaceNavigationCounts } from "@/lib/navigation/counts";

export default async function ApplicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [viewer, navigationCounts] = await Promise.all([
    requireActiveViewer(),
    getWorkspaceNavigationCounts(),
  ]);

  return (
    <AppShell navigationCounts={navigationCounts} viewer={viewer}>
      {children}
    </AppShell>
  );
}
