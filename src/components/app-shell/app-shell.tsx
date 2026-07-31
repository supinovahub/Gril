import {
  Building2,
  ChevronDown,
  CircleUserRound,
  ContactRound,
  KanbanSquare,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MessagesSquare,
  Sparkles,
  Settings2,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { signOutAction } from "@/app/(auth)/actions";
import {
  canManageTeam,
  roleLabels,
  type Viewer,
} from "@/lib/auth/session";
import styles from "./app-shell.module.css";

const futureItems = ["Campanhas", "Agenda"];

function initials(name: string | undefined, email: string) {
  const source = name?.trim() || email;
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AppShell({
  viewer,
  children,
}: {
  viewer: Viewer;
  children: React.ReactNode;
}) {
  const operation =
    viewer.operations.find((item) => item.is_default) ?? viewer.operations[0];
  const name = viewer.profile?.full_name;
  const memberRole = viewer.membership?.role ?? "broker";

  return (
    <div className={styles.appFrame}>
      <div className={styles.environmentBar}>
        <span /> Local · banco remoto de desenvolvimento · sem deploy Vercel
      </div>

      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/app">
          <span className={styles.brandMark}>P</span>
          <span>
            <strong>Pedro</strong>
            <small>Operação imobiliária</small>
          </span>
        </Link>

        <div className={styles.operationPicker}>
          <Building2 size={17} aria-hidden="true" />
          <span>
            <small>Operação ativa</small>
            <strong>{operation?.name ?? "Nenhuma operação"}</strong>
          </span>
          <ChevronDown size={15} aria-hidden="true" />
        </div>

        <nav className={styles.nav} aria-label="Navegação principal">
          <p className={styles.navLabel}>Agora</p>
          <Link className={styles.navItem} href="/app">
            <LayoutDashboard size={18} aria-hidden="true" /> Visão geral
          </Link>
          {canManageTeam(viewer) ? (
            <Link className={styles.navItem} href="/app/equipe">
              <UsersRound size={18} aria-hidden="true" /> Equipe e acessos
            </Link>
          ) : null}
          <Link className={styles.navItem} href="/app/perfil">
            <CircleUserRound size={18} aria-hidden="true" /> Meu perfil
          </Link>

          <p className={styles.navLabel}>Comercial</p>
          <Link className={styles.navItem} href="/app/leads">
            <ContactRound size={18} aria-hidden="true" /> Leads
          </Link>
          <Link className={styles.navItem} href="/app/kanban">
            <KanbanSquare size={18} aria-hidden="true" /> Kanban
          </Link>
          <Link className={styles.navItem} href="/app/inbox">
            <MessagesSquare size={18} aria-hidden="true" /> Inbox
          </Link>

          <p className={styles.navLabel}>Inteligência</p>
          <Link className={styles.navItem} href="/app/pedro">
            <Sparkles size={18} aria-hidden="true" /> Pedro
          </Link>

          <p className={styles.navLabel}>Próximas fases</p>
          {futureItems.map((item) => (
            <span className={styles.navItemDisabled} key={item}>
              <LockKeyhole size={16} aria-hidden="true" /> {item}
            </span>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.avatar}>{initials(name, viewer.email)}</div>
          <span className={styles.userCopy}>
            <strong>{name ?? viewer.email}</strong>
            <small>{roleLabels[memberRole] ?? memberRole}</small>
          </span>
          <form action={signOutAction}>
            <button className={styles.iconButton} title="Sair" type="submit">
              <LogOut size={17} aria-hidden="true" />
              <span className="srOnly">Sair</span>
            </button>
          </form>
        </div>
      </aside>

      <header className={styles.mobileHeader}>
        <Link className={styles.mobileBrand} href="/app">
          <span className={styles.brandMark}>P</span> Pedro
        </Link>
        <span>{operation?.name ?? "Sem operação"}</span>
      </header>

      <main className={styles.content}>{children}</main>

      <nav className={styles.mobileNav} aria-label="Navegação móvel">
        <Link href="/app"><LayoutDashboard size={20} /><span>Visão geral</span></Link>
        <Link href="/app/perfil"><Settings2 size={20} /><span>Perfil</span></Link>
        <Link href="/app/inbox"><MessagesSquare size={20} /><span>Inbox</span></Link>
        <Link href="/app/leads"><ContactRound size={20} /><span>Leads</span></Link>
        <Link href="/app/kanban"><KanbanSquare size={20} /><span>Kanban</span></Link>
        <Link href="/app/pedro"><Sparkles size={20} /><span>Pedro</span></Link>
      </nav>
    </div>
  );
}
