# Layouts atuais

## Layout raiz

Fonte: `src/app/layout.tsx`.

```tsx
import type { Metadata } from "next";
import { Manrope, Newsreader } from "next/font/google";

import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const interfaceFont = Manrope({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-interface",
});

const displayFont = Newsreader({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: {
    default: "Pedro | Operação imobiliária",
    template: "%s | Pedro",
  },
  description: "Operação imobiliária assistida pelo Pedro.",
  applicationName: "Pedro",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Pedro" },
};

export const viewport = { themeColor: "#1f1b17" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${interfaceFont.variable} ${displayFont.variable}`}>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
```

## Layout autenticado

Fonte: `src/app/app/layout.tsx`.

```tsx
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
```

## Shell autenticado

Fontes completas: `src/components/app-shell/app-shell.tsx` e `src/components/app-shell/app-shell.module.css`.

- Desktop: sidebar fixa de 248px, canvas bege e conteúdo com offset lateral.
- Preview/local: barra de ambiente de 28px acima do conteúdo.
- Mobile até 820px: header compacto e navegação inferior fixa de cinco itens.
- O shell contém gates reais de papel/permissão e contadores de Inbox, Chat com Pedro, Lionel e Assistente do corretor.
- A repaginação do Dashboard não altera o shell nesta primeira vertical. Ele precisa aparecer no canvas para avaliar a hierarquia no contexto real.
