# Componentes compartilhados atuais

## Stack

- Next.js 16.2.12 App Router com React 19.2.8.
- Server Components por padrão; ilhas cliente apenas para navegação ativa, realtime e confirmações.
- CSS global para tokens e CSS Modules para cada superfície.
- Ícones `lucide-react`; não há biblioteca externa de componentes.

## `NavLink`

Fonte: `src/components/app-shell/nav-link.tsx`. Link cliente que preserva o estado ativo por rota.

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  activeClassName,
  className,
  exact = false,
  href,
  children,
}: {
  activeClassName: string;
  className: string;
  exact?: boolean;
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`${className}${active ? ` ${activeClassName}` : ""}`}
      href={href}
    >
      {children}
    </Link>
  );
}
```

## `NotificationBadge`

Fonte: `src/components/notification-badge/notification-badge.tsx`. Contador semântico usado no shell.

```tsx
import styles from "./notification-badge.module.css";

export function NotificationBadge({
  count,
  label,
  className,
}: {
  count: number;
  label: string;
  className?: string;
}) {
  if (count <= 0) return null;

  return (
    <span
      aria-label={label}
      className={[styles.badge, className].filter(Boolean).join(" ")}
      title={label}
    >
      {count}
    </span>
  );
}
```

```css
.badge {
  display: inline-grid;
  min-width: 20px;
  height: 20px;
  flex: 0 0 auto;
  place-items: center;
  padding: 0 6px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 10px;
  font-weight: 820;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
```

## Controle protegido

`src/components/typed-confirmation-button.tsx` abre um `dialog` acessível e exige a frase canônica antes do submit. O Dashboard usa esse componente somente na área administrativa de limpeza HML. O design pode rebaixar visualmente essa área, mas não pode alterar sua ação, frase, escopo ou semântica.

## Regra de composição

O produto não possui `Card`, `MetricCard` ou `PageHeader` genéricos nesta base. Novas composições devem ser específicas ao trabalho operacional e evitar transformar toda informação em cartões equivalentes.
