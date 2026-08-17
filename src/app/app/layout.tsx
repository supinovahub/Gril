import { AppShell } from "@/components/app-shell/app-shell";
import { requireActiveViewer } from "@/lib/auth/session";

export default async function ApplicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await requireActiveViewer();

  return (
    <AppShell viewer={viewer}>
      {children}
    </AppShell>
  );
}
