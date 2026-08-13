# Page dependency trees

## Dashboard `/app`

```text
ApplicationLayout
└── AppShell
    └── DashboardPage
        ├── PageHeader
        ├── attention card → /app/conversas?view=unanswered
        ├── MetricCard × 5
        ├── recent activity list → /app/inbox/[id]
        ├── setup checklist → configuration/knowledge/Pedro routes
        └── owner/manager homologation details (collapsed)
```

Server dependencies include `requireActiveViewer`, Supabase organization/operation data, inbox notification counts, recent conversations, activity metrics and protected homologation preview. Preserve data contracts and admin-only visibility.

## Conversas `/app/conversas`

```text
ApplicationLayout
└── AppShell
    └── ConversationsPage
        ├── PageHeader
        ├── MetricCard × 4
        └── workspace
            ├── URL-backed Tabs × 6
            ├── query form (`view`, `q`)
            ├── list header
            ├── conversation rows
            │   ├── contact avatar
            │   ├── last message preview
            │   ├── pipeline StatusBadge
            │   ├── ownership/status StatusBadge
            │   ├── notification badge
            │   └── operation-local timestamp
            ├── EmptyState
            └── cursor pagination
```

The key user goal is to identify the next conversation to act on. The redesign should make attention, freshness, ownership and next-step context readable within one scan without changing filtering or ordering behavior.
