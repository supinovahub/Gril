import {
  Building2,
  CheckCircle2,
  Link2,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";

import { canManageTeam, requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import styles from "./dashboard.module.css";

export default async function DashboardPage() {
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const managesTeam = canManageTeam(viewer);

  let activeMembers = 1;
  let pendingMembers = 0;
  let activeInvites = 0;

  if (managesTeam) {
    const [activeResult, pendingResult, inviteResult] = await Promise.all([
      supabase
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("org_id", viewer.organization!.id)
        .eq("status", "active"),
      supabase
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("org_id", viewer.organization!.id)
        .eq("status", "pending"),
      supabase
        .from("invitation_links")
        .select("id", { count: "exact", head: true })
        .eq("org_id", viewer.organization!.id)
        .eq("status", "active"),
    ]);

    activeMembers = activeResult.count ?? 0;
    pendingMembers = pendingResult.count ?? 0;
    activeInvites = inviteResult.count ?? 0;
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Painel operacional</p>
          <h1>Bom dia, {viewer.profile?.full_name.split(" ")[0] ?? "time"}</h1>
          <p>{viewer.organization!.name} está isolada por organização e preparada para homologação controlada.</p>
        </div>
        <span className={styles.phaseBadge}>
          <CheckCircle2 size={15} aria-hidden="true" /> Homologação em andamento
        </span>
      </header>

      <section className={styles.stats} aria-label="Resumo de acesso">
        <article className={styles.stat}>
          <span><Building2 size={16} /> Operações visíveis</span>
          <strong>{viewer.operations.length}</strong>
        </article>
        <article className={styles.stat}>
          <span><UsersRound size={16} /> Pessoas ativas</span>
          <strong>{activeMembers}</strong>
        </article>
        <article className={styles.stat}>
          <span><Link2 size={16} /> Pendentes / convites</span>
          <strong>{managesTeam ? pendingMembers + activeInvites : "—"}</strong>
        </article>
      </section>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <header className={styles.panelHeader}>
            <h2>Operações disponíveis</h2>
            <span>Escopo aplicado pela RLS</span>
          </header>
          {viewer.operations.length ? (
            <ul className={styles.operationList}>
              {viewer.operations.map((operation) => (
                <li className={styles.operationRow} key={operation.id}>
                  <span className={styles.operationName}>
                    <strong>{operation.name}</strong>
                    <small>{operation.is_default ? "Operação padrão" : "Operação adicional"}</small>
                  </span>
                  <span className={styles.operationMeta}>{operation.timezone}</span>
                  <span className={styles.status}>
                    {operation.status === "active" ? "Ativa" : "Pausada"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>Nenhuma operação foi atribuída a este acesso.</p>
          )}
        </section>

        <aside className={styles.sidePanel}>
          <h2>Gate do piloto</h2>
          <ul className={styles.checklist}>
            <li>
              <ShieldCheck size={18} />
              <span><strong>Tenant isolado</strong>Organização e operação filtradas no banco.</span>
            </li>
            <li>
              <UserRoundCheck size={18} />
              <span><strong>Papéis ativos</strong>Dono, gestor e corretor vêm de memberships.</span>
            </li>
            <li>
              <CheckCircle2 size={18} />
              <span><strong>Hardening ligado</strong>Ativação, opt-out, IA e privacidade passam por gates auditáveis.</span>
            </li>
          </ul>
          <p className={styles.nextStep}>
            Próximo passo: conectar credenciais reais, executar os casos críticos e liberar uma conexão sem campanhas.
          </p>
        </aside>
      </div>
    </div>
  );
}
