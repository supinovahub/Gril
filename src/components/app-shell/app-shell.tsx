import {
  Activity,
  BarChart3,
  BookMarked,
  BookOpenCheck,
  Building2,
  CalendarClock,
  ChevronDown,
  CircleUserRound,
  ContactRound,
  Webhook,
  FlaskConical,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessagesSquare,
  Sparkles,
  Settings2,
  Search,
  ScrollText,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { signOutAction } from "@/app/(auth)/actions";
import { NotificationBadge } from "@/components/notification-badge/notification-badge";
import {
  canManageTeam,
  roleLabels,
  type Viewer,
} from "@/lib/auth/session";
import styles from "./app-shell.module.css";
import { RealtimeRefresh } from "./realtime-refresh";

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
  inboxNotificationCount,
  children,
}: {
  viewer: Viewer;
  inboxNotificationCount: number;
  children: React.ReactNode;
}) {
  const operation =
    viewer.operations.find((item) => item.is_default) ?? viewer.operations[0];
  const name = viewer.profile?.full_name;
  const memberRole = viewer.membership?.role ?? "broker";
  const isOwner = memberRole === "owner";
  const isManager = memberRole === "manager";
  const canConfigure = isOwner || viewer.permissions.includes("settings.manage");
  const canManageCampaigns = isOwner || viewer.permissions.includes("campaigns.manage");
  const canManageAi = isOwner || viewer.permissions.includes("ai.manage");
  const canViewReports = isOwner || memberRole === "broker" || viewer.permissions.includes("reports.view");
  const environmentLabel = process.env.VERCEL_ENV === "production"
    ? "Produção · Vercel"
    : process.env.VERCEL_ENV === "preview"
      ? "Homologação · Vercel Preview"
      : "Desenvolvimento · localhost · banco remoto autorizado";

  return (
    <div className={styles.appFrame}>
      <div className={styles.environmentBar}>
        <span /> {environmentLabel}
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
          <form action="/app/busca" className={styles.globalSearch}>
            <Search size={15} aria-hidden="true" />
            <input aria-label="Busca global" name="q" placeholder="Buscar na operação" />
          </form>
          <p className={styles.navLabel}>Agora</p>
          {memberRole === "broker" ? <Link className={styles.navItem} href="/app/hoje">
            <CalendarClock size={18} aria-hidden="true" /> Hoje
          </Link> : null}
          {memberRole === "broker" ? <Link className={styles.navItem} href="/app/meu-pipeline">
            <KanbanSquare size={18} aria-hidden="true" /> Meu pipeline
          </Link> : null}
          <Link className={styles.navItem} href="/app">
            <LayoutDashboard size={18} aria-hidden="true" /> Visão geral
          </Link>
          <Link className={styles.navItem} href="/app/central">
            <Activity size={18} aria-hidden="true" /> Central
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
            <NotificationBadge
              className={styles.navNotificationBadge}
              count={inboxNotificationCount}
              label={`${inboxNotificationCount} ${inboxNotificationCount === 1 ? "conversa com notificação" : "conversas com notificações"}`}
            />
          </Link>
          {canManageCampaigns ? <Link className={styles.navItem} href="/app/campanhas">
            <Megaphone size={18} aria-hidden="true" /> Campanhas
          </Link> : null}
          <Link className={styles.navItem} href="/app/agenda">
            <CalendarClock size={18} aria-hidden="true" /> Agenda
          </Link>

          <p className={styles.navLabel}>Inteligência</p>
          {canManageAi ? <Link className={styles.navItem} href="/app/pedro">
            <Sparkles size={18} aria-hidden="true" /> Pedro
          </Link> : null}
          {canManageAi ? <Link className={styles.navItem} href="/app/conhecimento">
            <BookOpenCheck size={18} aria-hidden="true" /> Conhecimento
          </Link> : null}
          {canManageAi ? <Link className={styles.navItem} href="/app/aprendizados">
            <BookMarked size={18} aria-hidden="true" /> Aprendizados
          </Link> : null}
          {canManageAi ? <Link className={styles.navItem} href="/app/simulador">
            <FlaskConical size={18} aria-hidden="true" /> Simulador
          </Link> : null}
          {canManageAi ? <Link className={styles.navItem} href="/app/pedro/experimentos">
            <FlaskConical size={18} aria-hidden="true" /> Experimentos A/B
          </Link> : null}
          {canViewReports ? <Link className={styles.navItem} href="/app/relatorios">
            <BarChart3 size={18} aria-hidden="true" /> Relatórios
          </Link> : null}
          {canConfigure ? <p className={styles.navLabel}>Configurações</p> : null}
          {canConfigure ? <Link className={styles.navItem} href="/app/configuracoes/organizacao">
            <Building2 size={18} aria-hidden="true" /> Organização
          </Link> : null}
          {canConfigure ? <Link className={styles.navItem} href="/app/configuracoes/whatsapp">
            <Settings2 size={18} aria-hidden="true" /> WhatsApp
          </Link> : null}
          {canConfigure ? <Link className={styles.navItem} href="/app/configuracoes/meta">
            <Webhook size={18} aria-hidden="true" /> Meta
          </Link> : null}
          {(isOwner || viewer.permissions.includes("checklists.manage")) ? <Link className={styles.navItem} href="/app/configuracoes/checklists">
            <BookOpenCheck size={18} aria-hidden="true" /> Checklists
          </Link> : null}
          {(isOwner || isManager) ? <Link className={styles.navItem} href="/app/configuracoes/privacidade">
            <ShieldCheck size={18} aria-hidden="true" /> Privacidade
          </Link> : null}
          {(isOwner || isManager || canViewReports) ? <Link className={styles.navItem} href="/app/configuracoes/auditoria">
            <ScrollText size={18} aria-hidden="true" /> Auditoria
          </Link> : null}
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

      <main className={styles.content}><RealtimeRefresh orgId={viewer.organization!.id} />{children}</main>

      <nav className={styles.mobileNav} aria-label="Navegação móvel">
        <Link href="/app"><LayoutDashboard size={20} /><span>Visão geral</span></Link>
        <Link href="/app/perfil"><Settings2 size={20} /><span>Perfil</span></Link>
        <Link href="/app/inbox">
          <span className={styles.mobileNavIcon}>
            <MessagesSquare aria-hidden="true" size={20} />
            <NotificationBadge
              className={styles.mobileNotificationBadge}
              count={inboxNotificationCount}
              label={`${inboxNotificationCount} ${inboxNotificationCount === 1 ? "conversa com notificação" : "conversas com notificações"}`}
            />
          </span>
          <span>Inbox</span>
        </Link>
        <Link href="/app/leads"><ContactRound size={20} /><span>Leads</span></Link>
        <Link href="/app/kanban"><KanbanSquare size={20} /><span>Kanban</span></Link>
        {canManageAi
          ? <Link href="/app/pedro"><Sparkles size={20} /><span>Pedro</span></Link>
          : <Link href="/app/agenda"><CalendarClock size={20} /><span>Agenda</span></Link>}
      </nav>
    </div>
  );
}
