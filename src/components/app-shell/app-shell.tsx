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
  FlaskConical,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Menu,
  Megaphone,
  MessagesSquare,
  MessageSquareText,
  BrainCircuit,
  Search,
  ScrollText,
  Settings2,
  ShieldCheck,
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
  internalChatNotificationCounts,
  children,
}: {
  viewer: Viewer;
  inboxNotificationCount: number;
  internalChatNotificationCounts: { pedro: number; lionel: number; broker: number };
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
  const canViewReports = isOwner || memberRole === "broker" || viewer.permissions.includes("reports.view");
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
          <span className={styles.brandMark}>P</span>
          <span className={styles.brandCopy}>
            <small>Gril operations</small>
            <strong>Pedro</strong>
          </span>
        </Link>

        <div className={styles.operationPicker}>
          <span className={styles.operationIcon}><Building2 size={16} aria-hidden="true" /></span>
          <span>
            <small>Operação em curso</small>
            <strong>{operation?.name ?? "Nenhuma operação"}</strong>
          </span>
          <ChevronDown size={14} aria-hidden="true" />
        </div>

        <nav className={styles.nav} aria-label="Navegação principal">
          <form action="/app/busca" className={styles.globalSearch}>
            <Search size={15} aria-hidden="true" />
            <input aria-label="Busca global" name="q" placeholder="Buscar lead, conversa..." />
          </form>

          <p className={styles.navLabel}>Atendimento</p>
          <NavLink activeClassName={styles.navItemActive} className={styles.navItem} exact href="/app">
            <LayoutDashboard size={17} aria-hidden="true" /><span>Visão geral</span>
          </NavLink>
          {memberRole === "broker" ? (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/hoje">
              <CalendarClock size={17} aria-hidden="true" /><span>Hoje</span>
            </NavLink>
          ) : null}
          <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/inbox">
            <MessagesSquare size={17} aria-hidden="true" /><span>Inbox</span>
            <NotificationBadge className={styles.navNotificationBadge} count={inboxNotificationCount} label={notificationLabel} />
          </NavLink>
          {memberRole === "broker" ? (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/assistente-corretor">
              <MessageSquareText size={17} aria-hidden="true" /><span>Assistente do corretor</span>
              <NotificationBadge className={styles.navNotificationBadge} count={internalChatNotificationCounts.broker} label={`${internalChatNotificationCounts.broker} consultas pendentes`} />
            </NavLink>
          ) : (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/chat-pedro">
              <MessageSquareText size={17} aria-hidden="true" /><span>Chat com Pedro</span>
              <NotificationBadge className={styles.navNotificationBadge} count={internalChatNotificationCounts.pedro} label={`${internalChatNotificationCounts.pedro} tópicos pendentes`} />
            </NavLink>
          )}
          <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/leads">
            <ContactRound size={17} aria-hidden="true" /><span>Leads</span>
          </NavLink>
          <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/agenda">
            <CalendarClock size={17} aria-hidden="true" /><span>Agenda</span>
          </NavLink>

          <p className={styles.navLabel}>Operação</p>
          <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/central">
            <Activity size={17} aria-hidden="true" /><span>Central</span>
          </NavLink>
          {memberRole === "broker" ? (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/meu-pipeline">
              <KanbanSquare size={17} aria-hidden="true" /><span>Meu pipeline</span>
            </NavLink>
          ) : (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/kanban">
              <KanbanSquare size={17} aria-hidden="true" /><span>Pipeline</span>
            </NavLink>
          )}
          {canManageCampaigns ? (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/campanhas">
              <Megaphone size={17} aria-hidden="true" /><span>Campanhas</span>
            </NavLink>
          ) : null}
          {canManageTeam(viewer) ? (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/equipe">
              <UsersRound size={17} aria-hidden="true" /><span>Equipe e acessos</span>
            </NavLink>
          ) : null}

          {canManageAi || canViewReports ? <p className={styles.navLabel}>Inteligência</p> : null}
          {canManageAi ? (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} exact href="/app/pedro">
              <Sparkles size={17} aria-hidden="true" /><span>Pedro IA</span>
            </NavLink>
          ) : null}
          {canManageAi ? (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/lionel">
              <BrainCircuit size={17} aria-hidden="true" /><span>Lionel</span>
              <NotificationBadge className={styles.navNotificationBadge} count={internalChatNotificationCounts.lionel} label={`${internalChatNotificationCounts.lionel} curadorias pendentes`} />
            </NavLink>
          ) : null}
          {canManageAi ? (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/conhecimento">
              <BookOpenCheck size={17} aria-hidden="true" /><span>Empreendimentos</span>
            </NavLink>
          ) : null}
          {canManageAi ? (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/aprendizados">
              <BookMarked size={17} aria-hidden="true" /><span>Aprendizados</span>
            </NavLink>
          ) : null}
          {canManageAi ? (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/simulador">
              <FlaskConical size={17} aria-hidden="true" /><span>Simulador</span>
            </NavLink>
          ) : null}
          {canManageAi ? (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/pedro/experimentos">
              <FlaskConical size={17} aria-hidden="true" /><span>Experimentos A/B</span>
            </NavLink>
          ) : null}
          {canViewReports ? (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/relatorios">
              <BarChart3 size={17} aria-hidden="true" /><span>Relatórios</span>
            </NavLink>
          ) : null}

          {canConfigure ? <p className={styles.navLabel}>Administração</p> : null}
          {canConfigure ? (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/configuracoes/organizacao">
              <Building2 size={17} aria-hidden="true" /><span>Organização</span>
            </NavLink>
          ) : null}
          {canConfigure ? (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/configuracoes/whatsapp">
              <Settings2 size={17} aria-hidden="true" /><span>WhatsApp</span>
            </NavLink>
          ) : null}
          {canConfigure ? (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/configuracoes/meta">
              <Webhook size={17} aria-hidden="true" /><span>Meta</span>
            </NavLink>
          ) : null}
          {(isOwner || viewer.permissions.includes("checklists.manage")) ? (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/configuracoes/checklists">
              <BookOpenCheck size={17} aria-hidden="true" /><span>Checklists</span>
            </NavLink>
          ) : null}
          {(isOwner || isManager) ? (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/configuracoes/privacidade">
              <ShieldCheck size={17} aria-hidden="true" /><span>Privacidade</span>
            </NavLink>
          ) : null}
          {(isOwner || isManager || canViewReports) ? (
            <NavLink activeClassName={styles.navItemActive} className={styles.navItem} href="/app/configuracoes/auditoria">
              <ScrollText size={17} aria-hidden="true" /><span>Auditoria</span>
            </NavLink>
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
          <span className={styles.brandMark}>P</span>
          <span><strong>Pedro</strong><small>{operation?.name ?? "Sem operação"}</small></span>
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
        <NavLink activeClassName={styles.mobileNavActive} className={styles.mobileNavItem} href="/app/inbox">
          <span className={styles.mobileNavIcon}>
            <MessagesSquare aria-hidden="true" size={19} />
            <NotificationBadge className={styles.mobileNotificationBadge} count={inboxNotificationCount} label={notificationLabel} />
          </span>
          <span>Inbox</span>
        </NavLink>
        <NavLink activeClassName={styles.mobileNavActive} className={styles.mobileNavItem} href="/app/leads">
          <ContactRound size={19} aria-hidden="true" /><span>Leads</span>
        </NavLink>
        <NavLink activeClassName={styles.mobileNavActive} className={styles.mobileNavItem} href="/app/agenda">
          <CalendarClock size={19} aria-hidden="true" /><span>Agenda</span>
        </NavLink>
        <details className={styles.mobileMore}>
          <summary><Menu size={19} aria-hidden="true" /><span>Mais</span></summary>
          <div className={styles.mobileMorePanel}>
            <p>Navegação</p>
            <NavLink activeClassName={styles.mobileMoreActive} className={styles.mobileMoreLink} href="/app/central"><Activity size={17} />Central</NavLink>
            <NavLink activeClassName={styles.mobileMoreActive} className={styles.mobileMoreLink} href={memberRole === "broker" ? "/app/meu-pipeline" : "/app/kanban"}><KanbanSquare size={17} />Pipeline</NavLink>
            {canManageCampaigns ? <NavLink activeClassName={styles.mobileMoreActive} className={styles.mobileMoreLink} href="/app/campanhas"><Megaphone size={17} />Campanhas</NavLink> : null}
            {canManageTeam(viewer) ? <NavLink activeClassName={styles.mobileMoreActive} className={styles.mobileMoreLink} href="/app/equipe"><UsersRound size={17} />Equipe</NavLink> : null}
            {canManageAi ? <NavLink activeClassName={styles.mobileMoreActive} className={styles.mobileMoreLink} exact href="/app/pedro"><Sparkles size={17} />Pedro IA</NavLink> : null}
            {memberRole === "broker" ? <NavLink activeClassName={styles.mobileMoreActive} className={styles.mobileMoreLink} href="/app/assistente-corretor"><MessageSquareText size={17} />Assistente do corretor</NavLink> : <NavLink activeClassName={styles.mobileMoreActive} className={styles.mobileMoreLink} href="/app/chat-pedro"><MessageSquareText size={17} />Chat com Pedro</NavLink>}
            {canManageAi ? <NavLink activeClassName={styles.mobileMoreActive} className={styles.mobileMoreLink} href="/app/lionel"><BrainCircuit size={17} />Lionel</NavLink> : null}
            {canManageAi ? <NavLink activeClassName={styles.mobileMoreActive} className={styles.mobileMoreLink} href="/app/conhecimento"><BookOpenCheck size={17} />Empreendimentos</NavLink> : null}
            {canManageAi ? <NavLink activeClassName={styles.mobileMoreActive} className={styles.mobileMoreLink} href="/app/simulador"><FlaskConical size={17} />Simulador</NavLink> : null}
            {canViewReports ? <NavLink activeClassName={styles.mobileMoreActive} className={styles.mobileMoreLink} href="/app/relatorios"><BarChart3 size={17} />Relatórios</NavLink> : null}
            {canConfigure ? <NavLink activeClassName={styles.mobileMoreActive} className={styles.mobileMoreLink} href="/app/configuracoes/organizacao"><Settings2 size={17} />Configurações</NavLink> : null}
            <NavLink activeClassName={styles.mobileMoreActive} className={styles.mobileMoreLink} href="/app/perfil"><CircleUserRound size={17} />Meu perfil</NavLink>
          </div>
        </details>
      </nav>
    </div>
  );
}
