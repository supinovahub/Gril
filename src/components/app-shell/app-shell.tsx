import {
  Activity,
  BookOpenCheck,
  Building2,
  CalendarClock,
  CircleUserRound,
  Ellipsis,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  Megaphone,
  MessagesSquare,
  Search,
  ScrollText,
  Settings2,
  Sparkles,
  UsersRound,
  Webhook,
} from "lucide-react";
import Link from "next/link";

import { signOutAction } from "@/app/(auth)/actions";
import { NotificationBadge } from "@/components/notification-badge/notification-badge";
import { canManageTeam, roleLabels, type Viewer } from "@/lib/auth/session";
import styles from "./app-shell.module.css";
import { NavLink } from "./nav-link";
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
  const operation = viewer.operations.find((item) => item.is_default) ?? viewer.operations[0];
  const name = viewer.profile?.full_name;
  const memberRole = viewer.membership?.role ?? "broker";
  const isOwner = memberRole === "owner";
  const isManager = memberRole === "manager";
  const canConfigure = isOwner || viewer.permissions.includes("settings.manage");
  const canManageCampaigns = isOwner || viewer.permissions.includes("campaigns.manage");
  const canManageAi = isOwner || viewer.permissions.includes("ai.manage");
  const canViewAudit = isOwner || isManager || viewer.permissions.includes("reports.view");
  const environmentLabel = process.env.VERCEL_ENV === "preview"
    ? "Ambiente de homologação"
    : process.env.VERCEL_ENV === "development" || !process.env.VERCEL_ENV
      ? "Desenvolvimento local · banco remoto"
      : null;
  const notificationLabel = `${inboxNotificationCount} ${inboxNotificationCount === 1 ? "conversa com notificação" : "conversas com notificações"}`;

  return (
    <div className={`${styles.appFrame}${environmentLabel ? ` ${styles.hasEnvironment}` : ""}`}>
      {environmentLabel ? (
        <div className={styles.environmentBar}>
          <span aria-hidden="true" /> {environmentLabel}
        </div>
      ) : null}

      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/app">
          <span className={styles.brandMark}>G</span>
          <span className={styles.brandCopy}>
            <small>Workspace comercial</small>
            <strong>Gril</strong>
          </span>
        </Link>

        <div className={styles.operationPicker}>
          <span className={styles.operationIcon}><Building2 size={16} aria-hidden="true" /></span>
          <span>
            <small>Imobiliária</small>
            <strong>{operation?.name ?? "Nenhuma operação"}</strong>
          </span>
          <span className={styles.operationStatus} title="Operação ativa" />
        </div>

        <nav className={styles.nav} aria-label="Navegação principal">
          <form action="/app/busca" className={styles.globalSearch}>
            <Search size={15} aria-hidden="true" />
            <input aria-label="Busca global" name="q" placeholder="Buscar lead, conversa..." />
          </form>

          <p className={styles.navLabel}>Principal</p>
          <NavLink activeClassName={styles.navItemActive} className={styles.navItem} exact href="/app">
            <LayoutDashboard size={17} aria-hidden="true" /><span>Visão geral</span>
          </NavLink>
          <NavLink activeClassName={styles.navItemActive} aliases={["/app/inbox", "/app/leads", "/app/kanban", "/app/meu-pipeline"]} className={styles.navItem} href="/app/conversas">
            <MessagesSquare size={17} aria-hidden="true" /><span>Conversas</span>
            <NotificationBadge className={styles.navNotificationBadge} count={inboxNotificationCount} label={notificationLabel} />
          </NavLink>
          <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/agenda">
            <CalendarClock size={17} aria-hidden="true" /><span>Agenda</span>
          </NavLink>

          <p className={styles.navLabel}>Trabalho</p>
          <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/central">
            <Activity size={17} aria-hidden="true" /><span>Central</span>
          </NavLink>
          {canManageCampaigns ? (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/campanhas">
              <Megaphone size={17} aria-hidden="true" /><span>Campanhas</span>
            </NavLink>
          ) : null}
          {canManageAi ? (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/conhecimento">
              <BookOpenCheck size={17} aria-hidden="true" /><span>Empreendimentos</span>
            </NavLink>
          ) : null}
          {canManageTeam(viewer) ? (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/equipe">
              <UsersRound size={17} aria-hidden="true" /><span>Equipe e acessos</span>
            </NavLink>
          ) : null}

          {canManageAi ? <p className={styles.navLabel}>Inteligência</p> : null}
          {canManageAi ? (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} exact href="/app/pedro">
              <Sparkles size={17} aria-hidden="true" /><span>Pedro IA</span>
            </NavLink>
          ) : null}
          {canManageAi ? (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/simulador">
              <FlaskConical size={17} aria-hidden="true" /><span>Simulador</span>
            </NavLink>
          ) : null}
          {canConfigure || canViewAudit ? (
            <details className={styles.adminNav}>
              <summary><Ellipsis size={17} aria-hidden="true" /><span>Administração</span></summary>
              <div>
                {canConfigure ? <NavLink activeClassName={styles.adminLinkActive} className={styles.adminLink} href="/app/configuracoes/organizacao"><Building2 size={16} />Organização</NavLink> : null}
                {canConfigure ? <NavLink activeClassName={styles.adminLinkActive} className={styles.adminLink} href="/app/configuracoes/whatsapp"><Settings2 size={16} />Integrações</NavLink> : null}
                {canConfigure ? <NavLink activeClassName={styles.adminLinkActive} className={styles.adminLink} href="/app/configuracoes/meta"><Webhook size={16} />Meta Cloud</NavLink> : null}
                {canViewAudit ? <NavLink activeClassName={styles.adminLinkActive} className={styles.adminLink} href="/app/configuracoes/auditoria"><ScrollText size={16} />Auditoria</NavLink> : null}
                <NavLink activeClassName={styles.adminLinkActive} className={styles.adminLink} href="/app/perfil"><CircleUserRound size={16} />Meu perfil</NavLink>
              </div>
            </details>
          ) : null}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.avatar}>{initials(name, viewer.email)}</div>
          <span className={styles.userCopy}>
            <strong>{name ?? viewer.email}</strong>
            <small>{roleLabels[memberRole] ?? memberRole}</small>
          </span>
          <form action={signOutAction}>
            <button className={styles.iconButton} title="Sair" type="submit">
              <LogOut size={16} aria-hidden="true" /><span className="srOnly">Sair</span>
            </button>
          </form>
        </div>
      </aside>

      <header className={styles.mobileHeader}>
        <Link className={styles.mobileBrand} href="/app">
          <span className={styles.brandMark}>G</span>
          <span><strong>Gril</strong><small>{operation?.name ?? "Sem operação"}</small></span>
        </Link>
        <div className={styles.mobileAvatar}>{initials(name, viewer.email)}</div>
      </header>

      <main className={styles.content}>
        <RealtimeRefresh orgId={viewer.organization!.id} />
        {children}
      </main>

      <nav className={styles.mobileNav} aria-label="Navegação móvel">
        <NavLink activeClassName={styles.mobileNavActive} className={styles.mobileNavItem} exact href="/app">
          <LayoutDashboard size={19} aria-hidden="true" /><span>Início</span>
        </NavLink>
        <NavLink activeClassName={styles.mobileNavActive} aliases={["/app/inbox", "/app/leads", "/app/kanban", "/app/meu-pipeline"]} className={styles.mobileNavItem} href="/app/conversas">
          <span className={styles.mobileNavIcon}>
            <MessagesSquare aria-hidden="true" size={19} />
            <NotificationBadge className={styles.mobileNotificationBadge} count={inboxNotificationCount} label={notificationLabel} />
          </span>
          <span>Conversas</span>
        </NavLink>
        <NavLink activeClassName={styles.mobileNavActive} className={styles.mobileNavItem} href="/app/agenda">
          <CalendarClock size={19} aria-hidden="true" /><span>Agenda</span>
        </NavLink>
        <NavLink activeClassName={styles.mobileNavActive} className={styles.mobileNavItem} href="/app/central">
          <Activity size={19} aria-hidden="true" /><span>Central</span>
        </NavLink>
        <details className={styles.mobileMore}>
          <summary><Menu size={19} aria-hidden="true" /><span>Mais</span></summary>
          <div className={styles.mobileMorePanel}>
            <p>Navegação</p>
            <NavLink activeClassName={styles.mobileMoreActive} className={styles.mobileMoreLink} href="/app/central"><Activity size={17} />Central</NavLink>
            {canManageCampaigns ? <NavLink activeClassName={styles.mobileMoreActive} className={styles.mobileMoreLink} href="/app/campanhas"><Megaphone size={17} />Campanhas</NavLink> : null}
            {canManageTeam(viewer) ? <NavLink activeClassName={styles.mobileMoreActive} className={styles.mobileMoreLink} href="/app/equipe"><UsersRound size={17} />Equipe</NavLink> : null}
            {canManageAi ? <NavLink activeClassName={styles.mobileMoreActive} className={styles.mobileMoreLink} exact href="/app/pedro"><Sparkles size={17} />Pedro IA</NavLink> : null}
            {canManageAi ? <NavLink activeClassName={styles.mobileMoreActive} className={styles.mobileMoreLink} href="/app/conhecimento"><BookOpenCheck size={17} />Empreendimentos</NavLink> : null}
            {canManageAi ? <NavLink activeClassName={styles.mobileMoreActive} className={styles.mobileMoreLink} href="/app/simulador"><FlaskConical size={17} />Simulador</NavLink> : null}
            {canConfigure ? <NavLink activeClassName={styles.mobileMoreActive} className={styles.mobileMoreLink} href="/app/configuracoes/organizacao"><Settings2 size={17} />Configurações</NavLink> : null}
            {canViewAudit ? <NavLink activeClassName={styles.mobileMoreActive} className={styles.mobileMoreLink} href="/app/configuracoes/auditoria"><ScrollText size={17} />Auditoria</NavLink> : null}
            <NavLink activeClassName={styles.mobileMoreActive} className={styles.mobileMoreLink} href="/app/perfil"><CircleUserRound size={17} />Meu perfil</NavLink>
          </div>
        </details>
      </nav>
    </div>
  );
}
