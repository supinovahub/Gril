# Existing component inventory

This is a server-rendered Next.js 16 App Router product. The canonical source remains the files below; this inventory is the design context for the redesign.

## App shell

- `src/components/app-shell/app-shell.tsx`: full authenticated shell. Owns sidebar, environment banner, operation context, global search, permission-aware navigation, account footer, mobile header and mobile navigation. It must preserve all current hrefs, labels, aliases and permission gates.
- `src/components/app-shell/app-shell.module.css`: shell layout, fixed desktop sidebar, mobile navigation and responsive breakpoints.
- `src/components/app-shell/nav-link.tsx`: active route link with optional aliases.
- `src/components/app-shell/realtime-refresh.tsx`: route-aware realtime refresh; do not replace with scroll listeners or polling.

## Shared UI primitives

- `src/components/ui/button.tsx`: `Button` and `ButtonLink`; variants `primary`, `secondary`, `quiet`, `danger`; sizes `sm`, `md`, `lg`.
- `src/components/ui/card.tsx`: semantic `Card` with `default`, `soft`, `dark` tones.
- `src/components/ui/empty-state.tsx`: empty resource state with icon, title, description and optional action.
- `src/components/ui/form-field.tsx`: label, control and help/error copy.
- `src/components/ui/icon-button.tsx`: icon-only action with accessible label.
- `src/components/ui/metric-card.tsx`: linked or static KPI card with label, value, hint and optional accent.
- `src/components/ui/page-header.tsx`: eyebrow, title, description and right-side actions.
- `src/components/ui/status-badge.tsx`: neutral/positive/warning/danger/accent state label.
- `src/components/ui/tabs.tsx`: URL-backed tabs with label and optional description.
- `src/components/ui/ui.module.css`: current primitive styles; this is the main consolidation point for the new visual system.

## Product surfaces in scope for the first redesign pass

### Dashboard

`src/app/app/page.tsx` composes `PageHeader`, an attention CTA, `MetricCard` KPI strip, recent activity, setup checklist and a collapsed owner-only homologation control. It reads Supabase server data and preserves all existing actions and links.

### Conversas

`src/app/app/conversas/page.tsx` composes `PageHeader`, four `MetricCard`s, URL-backed `Tabs`, search, conversation rows, `StatusBadge`, notification badges, empty state and cursor pagination. It is the primary work surface and must remain dense, scannable and operationally safe.

### Design constraints

- Keep all backend reads, server actions, RLS assumptions, URLs, navigation labels, form field names and legal/operational copy intact unless a separate product decision says otherwise.
- Use Lucide icons already installed; do not introduce decorative iconography or fake screenshots.
- Every visual state must work at keyboard focus, hover, disabled, loading, error, empty and mobile widths.

## Source snapshots used by the design pass

The full source of truth is loaded from the repository paths above. The most important current tokens are copied into `init/theme.md`; the redesign draft must be judged against the actual rendered app, not this inventory alone.
