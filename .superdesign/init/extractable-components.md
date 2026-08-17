# Catálogo de extração

## Componentes básicos

### NotificationBadge

- Source: `src/components/notification-badge/notification-badge.tsx`
- Category: basic
- Description: contador semântico de notificações.
- Extractable props: `count`, `label`.
- Hardcoded: geometria, cor de acento e tipografia numérica.

### NavLink

- Source: `src/components/app-shell/nav-link.tsx`
- Category: basic
- Description: link que aplica estado ativo pela rota atual.
- Extractable props: `href`, `exact`, estado ativo.
- Hardcoded: nenhuma aparência; classes vêm do shell.

## Componentes de layout

Nenhum componente de layout é seguro para extração automática neste ciclo. `AppShell` mistura gates de papel, contadores vivos, formulários e variantes desktop/mobile; convertê-lo para template Petite-Vue reduziria fidelidade. O design deve receber os arquivos reais do shell como contexto.

## Candidatos depois da aprovação

- `DashboardSectionHeader`: título curto, contexto e ação vinculada.
- `AttentionQueueRow`: lead, motivo, espera, responsável e ação seguinte.
- `CommercialPulse`: contagens e tendência sem grade de cartões equivalentes.

Não extrair loaders, queries Supabase, server actions, autorização ou uma abstração genérica de cartão.
