# Route inventory for the redesign

## Primary navigation

| Route | Current label | User job | Preserve |
|---|---|---|---|
| `/app` | Visão geral | Understand what needs attention now | URL, role-aware admin section |
| `/app/conversas` | Conversas | Work inbound leads and messages | `/app/inbox` alias, query params `view`, `q`, `cursor` |
| `/app/agenda` | Agenda | Review and manage calls | URL and schedule actions |
| `/app/central` | Central de operações | Monitor operational events | URL and event links |
| `/app/campanhas` | Campanhas | Manage reactivation campaigns | permission gate and wizard flow |
| `/app/equipe` | Equipe e acessos | Manage team and invites | permission gate |
| `/app/pedro` | Pedro IA | Review AI behavior and suggestions | permission gate and modes |
| `/app/conhecimento` | Empreendimentos | Manage AI knowledge | permission gate |
| `/app/simulador` | Simulador | Test behavior without side effects | permission gate |
| `/app/configuracoes/*` | Administração | Configure integrations, privacy, checklists and audit | route compatibility and role gates |

## Deep links that must survive

- `/app/inbox` remains an alias of `/app/conversas`.
- `/app/inbox/[id]` remains the conversation detail route.
- `/app/conversas?view=unanswered|working|scheduled|converted|archived` remains URL-addressable.
- Lead, agenda, campaign, Pedro and audit deep links remain intact.

## Redesign boundary

The visual pass may consolidate the shell and improve the hierarchy of dashboard/conversation surfaces. It must not silently remove a route, rename a nav label, alter a form field name, or change a server action contract.
