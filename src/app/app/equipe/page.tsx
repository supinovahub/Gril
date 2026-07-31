import { Link2, UserRoundPlus, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";

import type { Tables } from "@/lib/database.types";
import {
  canManageTeam,
  requireActiveViewer,
  roleLabels,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  changeMembershipAction,
  updateManagerPermissionsAction,
} from "./actions";
import { permissionOptions } from "./constants";
import { InviteForm } from "./invite-form";
import styles from "./team.module.css";

const statusLabels: Record<string, string> = {
  active: "Ativo",
  pending: "Pendente",
  suspended: "Suspenso",
  revoked: "Revogado",
};

const permissionLabels: Record<(typeof permissionOptions)[number], string> = {
  "settings.manage": "Configurações gerais",
  "team.manage": "Gerenciar corretores",
  "operations.manage": "Gerenciar operações",
  "contacts.manage": "Gerenciar contatos",
  "campaigns.manage": "Gerenciar campanhas",
  "pipeline.manage": "Gerenciar pipeline",
  "reports.view": "Visualizar relatórios",
  "ai.manage": "Operar o Pedro",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function statusClass(status: string) {
  if (status === "pending") return `${styles.status} ${styles.pending}`;
  if (status !== "active") return `${styles.status} ${styles.inactive}`;
  return styles.status;
}

export default async function TeamPage() {
  const viewer = await requireActiveViewer();
  if (!canManageTeam(viewer)) redirect("/app");

  const supabase = await createClient();
  const [{ data: memberships }, { data: invitations }] = await Promise.all([
    supabase
      .from("memberships")
      .select("*")
      .eq("org_id", viewer.organization!.id)
      .order("created_at"),
    supabase
      .from("invitation_links")
      .select("*")
      .eq("org_id", viewer.organization!.id)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const memberRows = memberships ?? [];
  const memberIds = memberRows.map((member) => member.id);
  const userIds = memberRows.map((member) => member.user_id);

  let profiles: Pick<Tables<"profiles">, "user_id" | "full_name" | "whatsapp_e164">[] = [];
  let permissions: Pick<Tables<"membership_permissions">, "membership_id" | "permission">[] = [];

  if (memberRows.length) {
    const [profileResult, permissionResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, full_name, whatsapp_e164")
        .in("user_id", userIds),
      supabase
        .from("membership_permissions")
        .select("membership_id, permission")
        .in("membership_id", memberIds),
    ]);
    profiles = profileResult.data ?? [];
    permissions = permissionResult.data ?? [];
  }

  const profilesByUser = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const permissionsByMembership = new Map<string, Set<string>>();
  permissions.forEach((permission) => {
    const set = permissionsByMembership.get(permission.membership_id) ?? new Set<string>();
    set.add(permission.permission);
    permissionsByMembership.set(permission.membership_id, set);
  });

  const isOwner = viewer.membership?.role === "owner";
  const activeCount = memberRows.filter((member) => member.status === "active").length;
  const pendingCount = memberRows.filter((member) => member.status === "pending").length;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Pessoas e segurança</p>
          <h1>Equipe e acessos</h1>
          <p>Convide, aprove e limite o que cada pessoa pode operar.</p>
        </div>
        <span className={styles.summary}>{activeCount} ativos · {pendingCount} pendentes</span>
      </header>

      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <div><UserRoundPlus size={18} /><h2>Novo acesso</h2></div>
          <span>O token puro aparece uma única vez</span>
        </header>
        <InviteForm
          canInviteManager={isOwner}
          operations={viewer.operations.map(({ id, name }) => ({ id, name }))}
        />
      </section>

      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <div><UsersRound size={18} /><h2>Pessoas vinculadas</h2></div>
          <span>Fonte: memberships + RLS</span>
        </header>

        {memberRows.length ? (
          <ul className={styles.memberList}>
            {memberRows.map((member) => {
              const profile = profilesByUser.get(member.user_id);
              const displayName = profile?.full_name ?? `Usuário ${member.user_id.slice(0, 8)}`;
              const isSelf = member.user_id === viewer.userId;
              const canAct = member.role !== "owner" && !isSelf;
              const assignedPermissions = permissionsByMembership.get(member.id) ?? new Set<string>();

              return (
                <li className={styles.member} key={member.id}>
                  <div className={styles.memberMain}>
                    <div className={styles.person}>
                      <span className={styles.avatar}>{initials(displayName)}</span>
                      <span>
                        <strong>{displayName}{isSelf ? " · você" : ""}</strong>
                        <small>{profile?.whatsapp_e164 ?? "WhatsApp não informado"}</small>
                      </span>
                    </div>

                    <span className={styles.role}>{roleLabels[member.role] ?? member.role}</span>
                    <span className={statusClass(member.status)}>{statusLabels[member.status]}</span>

                    {member.status === "pending" && canAct ? (
                      <form action={changeMembershipAction} className={styles.approveForm}>
                        <input name="membershipId" type="hidden" value={member.id} />
                        <input name="requestedAction" type="hidden" value="approve" />
                        {isOwner ? (
                          <select name="requestedRole" defaultValue="broker" aria-label="Papel ao aprovar">
                            <option value="broker">Corretor</option>
                            <option value="manager">Gestor</option>
                          </select>
                        ) : (
                          <input name="requestedRole" type="hidden" value="broker" />
                        )}
                        <button className={styles.actionButton} type="submit">Aprovar</button>
                      </form>
                    ) : null}

                    {member.status === "active" && canAct ? (
                      <div className={styles.memberActions}>
                        <form action={changeMembershipAction}>
                          <input name="membershipId" type="hidden" value={member.id} />
                          <input name="requestedAction" type="hidden" value="suspend" />
                          <button className={styles.actionButton} type="submit">Suspender</button>
                        </form>
                        <form action={changeMembershipAction}>
                          <input name="membershipId" type="hidden" value={member.id} />
                          <input name="requestedAction" type="hidden" value="revoke" />
                          <button className={styles.dangerButton} type="submit">Revogar</button>
                        </form>
                      </div>
                    ) : null}

                    {member.status === "suspended" && canAct ? (
                      <form action={changeMembershipAction} className={styles.memberActions}>
                        <input name="membershipId" type="hidden" value={member.id} />
                        <input name="requestedAction" type="hidden" value="reactivate" />
                        <button className={styles.actionButton} type="submit">Reativar</button>
                      </form>
                    ) : null}
                  </div>

                  {isOwner && member.role === "manager" && member.status !== "revoked" ? (
                    <details className={styles.permissions}>
                      <summary>Permissões do gestor</summary>
                      <form
                        action={updateManagerPermissionsAction.bind(null, member.id)}
                        className={styles.permissionForm}
                      >
                        {permissionOptions.map((permission) => (
                          <label key={permission}>
                            <input
                              defaultChecked={assignedPermissions.has(permission)}
                              name="permission"
                              type="checkbox"
                              value={permission}
                            />
                            {permissionLabels[permission]}
                          </label>
                        ))}
                        <button className={styles.savePermissions} type="submit">Salvar permissões</button>
                      </form>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.empty}>Nenhum vínculo encontrado.</p>
        )}
      </section>

      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <div><Link2 size={18} /><h2>Convites recentes</h2></div>
          <span>Links não exibem o token armazenado</span>
        </header>

        {invitations?.length ? (
          <table className={styles.inviteList}>
            <thead>
              <tr><th>Tipo</th><th>Destino</th><th>Uso</th><th>Expira</th><th>Status</th></tr>
            </thead>
            <tbody>
              {invitations.map((invitation) => (
                <tr key={invitation.id}>
                  <td>{invitation.kind === "general" ? "Link geral" : "Individual"}</td>
                  <td>{invitation.email ?? "Qualquer corretor"}</td>
                  <td>{invitation.used_count}/{invitation.max_uses}</td>
                  <td>{new Intl.DateTimeFormat("pt-BR").format(new Date(invitation.expires_at))}</td>
                  <td>{invitation.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={styles.empty}>Nenhum convite criado.</p>
        )}
      </section>
    </div>
  );
}
