# Árvores de dependência das páginas principais

## `/app` Dashboard

```text
src/app/layout.tsx
└── src/app/app/layout.tsx
    ├── src/components/app-shell/app-shell.tsx
    │   ├── src/components/app-shell/nav-link.tsx
    │   ├── src/components/app-shell/realtime-refresh.tsx
    │   ├── src/components/notification-badge/notification-badge.tsx
    │   ├── src/components/app-shell/app-shell.module.css
    │   └── src/components/notification-badge/notification-badge.module.css
    └── src/app/app/page.tsx
        ├── src/app/app/dashboard.module.css
        ├── src/components/typed-confirmation-button.tsx
        ├── src/components/typed-confirmation-button.module.css
        ├── src/app/app/homologation-actions.ts
        ├── src/lib/auth/session.ts
        └── src/lib/supabase/server.ts
```

O branch real de render do Dashboard está integralmente em `src/app/app/page.tsx`: cabeçalho de homologação, três KPIs técnicos, primeiros passos, lista de operações, gate do piloto e limpeza HML condicionada a gestão de equipe.

## `/app/inbox`

```text
src/app/app/inbox/page.tsx
├── src/app/app/inbox/inbox.module.css
├── src/lib/auth/session.ts
├── src/lib/inbox/notifications.ts
└── src/lib/supabase/server.ts
```

## `/app/central`

```text
src/app/app/central/page.tsx
├── src/app/app/central/actions.ts
├── src/app/app/operations.module.css
└── src/lib/internal-chat/notifications.ts
```

## `/app/relatorios`

```text
src/app/app/relatorios/page.tsx
├── src/app/app/operations.module.css
├── src/lib/auth/session.ts
└── src/lib/supabase/server.ts
```

## `/app/hoje`

```text
src/app/app/hoje/page.tsx
├── src/app/app/operations.module.css
├── src/lib/auth/session.ts
└── src/lib/supabase/server.ts
```
