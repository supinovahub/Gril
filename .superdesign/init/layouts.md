# Existing layout map

## Authenticated application layout

Source: `src/app/app/layout.tsx`

```tsx
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
```

## Root layout

Source: `src/app/layout.tsx`. The product uses `Manrope` as the interface font and `Newsreader` as the display font, exposed as `--font-interface` and `--font-display`. The redesign may refine type scale and hierarchy but should not add a font dependency without a clear reason.

## Current shell geometry

- Desktop fixed sidebar: 248px.
- Main content is offset by the sidebar and uses a centered max width between 1280px and 1380px depending on surface.
- Environment banner is fixed above content for preview/local environments.
- Mobile has a compact header and bottom navigation with Início, Conversas, Agenda, Central and Mais.
- The design draft should preserve this information architecture while improving hierarchy, whitespace rhythm and interaction clarity.
