# Extractable component catalog

## Keep and refine

1. `AppShell`: global chrome, responsive navigation, environment context and account controls.
2. `PageHeader`: consistent page intro and action area.
3. `MetricCard`: compact KPI link with semantic accent state.
4. `Button` / `ButtonLink`: action hierarchy and loading/disabled states.
5. `IconButton`: compact icon action with tooltip/accessible name.
6. `Card`: only for meaningful grouping, not every section.
7. `Tabs`: URL-backed view switching with selected state.
8. `StatusBadge`: ownership, status and pipeline context.
9. `EmptyState`: resource-specific empty/error recovery.
10. `FormField`: consistent label, help, error and focus behavior.

## New composition candidates

- `AttentionRail`: one compact action strip for “what needs attention now”.
- `WorklistRow`: conversation row with explicit hierarchy: person, last message, ownership, status and age.
- `SectionHeading`: small label/title/action composition for dashboard modules.
- `ShellSection`: navigation group that can collapse visually on mobile without changing routes.

## Do not extract yet

- Server data loaders, server actions, authorization logic, Supabase query builders or product-specific mutation flows.
- A generic “dashboard card” abstraction that hides semantics and encourages repeated cards.
