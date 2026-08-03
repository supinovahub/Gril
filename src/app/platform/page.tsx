import { Building2, KeyRound, ShieldCheck, UserCog, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";

import { signOutAction } from "@/app/(auth)/actions";
import { CopyButton } from "@/app/app/equipe/copy-button";
import { TypedConfirmationButton } from "@/components/typed-confirmation-button";
import type { Json } from "@/lib/database.types";
import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  addPlatformRequestNoteAction, clearSupportContextAction, controlOrganizationAction, controlUserAction,
  decidePlatformAccessRequestAction, enterSupportContextAction, invitePlatformAccountAction,
  managePlatformPrincipalAction, manageSupportGrantAction, preauthorizeOrganizationAction,
} from "./actions";
import { PlatformPushSubscription } from "./platform-push-subscription";
import styles from "./platform.module.css";

type OrganizationRow = { id: string; name: string; status: string; city: string | null; state: string | null; active_members: number; open_opportunities: number; support_grant: { id: string; access_level: string; contract_reference: string; expires_at: string | null } | null };
type RequestRow = { id: string; requester_user_id: string; request_type: string; org_id: string | null; organization_target: string | null; status: string; full_name: string; email: string; whatsapp_e164: string; introduction: string | null; organization_name: string | null; city: string | null; state: string | null; cnpj: string | null; creci: string | null; approximate_brokers: number | null; operation_description: string | null; public_reason: string | null; version: number; created_at: string; internal_notes: { action: string; note: string; occurred_at: string }[] };
type PrincipalRow = { user_id: string; email: string; role: string; active: boolean; created_at: string };
type PreauthorizationRow = { id: string; email: string; status: string; expires_at: string; created_at: string };
type UserRow = { user_id: string; email: string; full_name: string | null; whatsapp_e164: string | null; membership_id: string | null; org_id: string | null; organization_name: string | null; membership_role: string | null; membership_status: string | null; account_suspended: boolean; requests_blocked: boolean; public_message: string | null; created_at: string };
type Snapshot = { role: "platform_admin" | "support"; unread_notifications: number; organizations: OrganizationRow[]; requests: RequestRow[]; principals: PrincipalRow[]; preauthorizations: PreauthorizationRow[] };

function asSnapshot(value: Json | null): Snapshot | null { return value && typeof value === "object" && !Array.isArray(value) ? value as unknown as Snapshot : null; }
function asUsers(value: Json | null): UserRow[] { return Array.isArray(value) ? value as unknown as UserRow[] : []; }

export default async function PlatformPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string; link?: string }> }) {
  const viewer = await requireViewer();
  if (!viewer.platformRole) redirect("/app");
  const feedback = await searchParams;
  const supabase = await createClient();
  const [{ data: snapshotData, error }, usersResult] = await Promise.all([
    supabase.rpc("platform_control_snapshot"),
    viewer.platformRole === "platform_admin" ? supabase.rpc("platform_user_directory") : Promise.resolve({ data: null }),
  ]);
  const snapshot = asSnapshot(snapshotData);
  if (error || !snapshot) redirect("/app");
  const users = asUsers(usersResult.data);
  const isAdmin = snapshot.role === "platform_admin";

  return <main className={styles.page}>
    <header className={styles.hero}><div><p className={styles.eyebrow}>Plataforma Gril</p><h1>Controle geral e aprovações</h1><p>Solicitações, acessos contratuais e integridade das imobiliárias em um único registro auditável.</p></div><div className={styles.heroActions}><span>{snapshot.unread_notifications} novas</span><PlatformPushSubscription publicKey={process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? ""} /><form action={signOutAction}><button>Sair</button></form></div></header>
    {viewer.supportAccess ? <section className={styles.notice}>Você está em contexto de suporte <strong>{viewer.supportAccess}</strong> para {viewer.organization?.name}.<form action={clearSupportContextAction}><button>Encerrar contexto</button></form></section> : null}
    {feedback.erro ? <p className={styles.error}>{feedback.erro}</p> : null}{feedback.sucesso ? <p className={styles.success}>{feedback.sucesso}</p> : null}
    {feedback.link ? <div className={styles.copyLine}><code>{feedback.link}</code><CopyButton value={feedback.link} /></div> : null}

    <section className={styles.metrics}><article><small>Imobiliárias</small><strong>{snapshot.organizations.length}</strong></article><article><small>Solicitações abertas</small><strong>{snapshot.requests.length}</strong></article><article><small>Contas normais</small><strong>{users.length}</strong></article><article><small>Seu papel</small><strong>{isAdmin ? "Admin" : "Suporte"}</strong></article></section>

    <section className={styles.panel}><header><div><UserCog /><h2>Fila de solicitações</h2></div><span>Suporte pode consultar e anotar; somente quem tem autoridade decide.</span></header>
      <div className={styles.list}>{snapshot.requests.map((request) => <article className={styles.request} key={request.id}><div className={styles.requestData}><span className={styles.status}>{request.status}</span><h3>{request.request_type === "create_organization" ? request.organization_name : `${request.full_name} → ${request.organization_target}`}</h3><p>{request.full_name} · {request.email} · {request.whatsapp_e164}</p><small>{request.city && request.state ? `${request.city}/${request.state} · ` : ""}v{request.version} · {new Date(request.created_at).toLocaleString("pt-BR")}</small>{request.operation_description ? <p>{request.operation_description}</p> : null}{request.internal_notes?.map((note, index) => <aside key={`${note.occurred_at}-${index}`}>{note.note} <small>{new Date(note.occurred_at).toLocaleString("pt-BR")}</small></aside>)}</div>
        <div className={styles.requestActions}><form action={addPlatformRequestNoteAction}><input name="requestId" type="hidden" value={request.id} /><input name="note" placeholder="Nota interna (só suporte)" required /><button>Registrar nota</button></form>
          {isAdmin && request.request_type === "create_organization" ? <>
            {request.status === "pending" ? <form action={decidePlatformAccessRequestAction}><input name="requestId" type="hidden" value={request.id} /><input name="decision" type="hidden" value="approve" /><input name="internalNote" placeholder="Nota interna opcional" /><TypedConfirmationButton description="A solicitação ficará aprovada sem prazo de expiração, até a criação da imobiliária ou revogação manual." title="Aprovar imobiliária">Aprovar normalmente</TypedConfirmationButton></form> : null}
            {request.status === "pending" ? <form action={decidePlatformAccessRequestAction}><input name="requestId" type="hidden" value={request.id} /><input name="decision" type="hidden" value="approve_30_days" /><input name="internalNote" placeholder="Nota interna opcional" /><TypedConfirmationButton description="A pessoa terá 30 dias para concluir a criação da imobiliária. Depois desse prazo, a autorização expirará automaticamente." title="Aprovar por 30 dias">Aprovar por 30 dias</TypedConfirmationButton></form> : null}
            {request.status === "pending" ? <form action={decidePlatformAccessRequestAction}><input name="requestId" type="hidden" value={request.id} /><input name="decision" type="hidden" value="request_correction" /><input name="publicReason" placeholder="Correção solicitada" required /><input name="internalNote" placeholder="Nota interna opcional" /><TypedConfirmationButton>Pedir correção</TypedConfirmationButton></form> : null}
            {request.status === "pending" || request.status === "correction_requested" ? <form action={decidePlatformAccessRequestAction}><input name="requestId" type="hidden" value={request.id} /><input name="decision" type="hidden" value="reject" /><input name="publicReason" placeholder="Motivo público" required /><input name="internalNote" placeholder="Nota interna opcional" /><TypedConfirmationButton className={styles.danger}>Recusar</TypedConfirmationButton></form> : null}
            {request.status === "approved" ? <form action={decidePlatformAccessRequestAction}><input name="requestId" type="hidden" value={request.id} /><input name="decision" type="hidden" value="revoke_approval" /><input name="publicReason" placeholder="Motivo público" required /><TypedConfirmationButton className={styles.danger}>Revogar autorização</TypedConfirmationButton></form> : null}
          </> : null}
        </div></article>)}{!snapshot.requests.length ? <p className={styles.empty}>Nenhuma solicitação aberta.</p> : null}</div>
    </section>

    <section className={styles.panel}><header><div><Building2 /><h2>Imobiliárias</h2></div><span>Suspensão registra inbound, mas bloqueia toda saída.</span></header>
      <div className={styles.orgGrid}>{snapshot.organizations.map((organization) => <article className={styles.org} key={organization.id}><div><span className={styles.status}>{organization.status}</span><h3>{organization.name}</h3><p>{[organization.city, organization.state].filter(Boolean).join("/") || "Localidade não informada"}</p><small>{organization.active_members} membros · {organization.open_opportunities} oportunidades abertas</small></div>
        {organization.support_grant ? <div className={styles.grant}><ShieldCheck size={15} /> Suporte {organization.support_grant.access_level}</div> : null}
        <div className={styles.actions}>{organization.support_grant ? <form action={enterSupportContextAction}><input name="organizationId" type="hidden" value={organization.id} /><button>Entrar com concessão</button></form> : null}
          {isAdmin ? <details><summary>Controles</summary><div className={styles.detailBody}>
            <form action={controlOrganizationAction}><input name="organizationId" type="hidden" value={organization.id} /><select name="action" defaultValue={organization.status === "active" ? "suspend" : organization.status === "suspended" ? "reactivate" : "restore"}><option value="suspend">Suspender</option><option value="reactivate">Reativar</option><option value="archive">Arquivar</option><option value="restore">Restaurar arquivo</option></select><input name="publicMessage" placeholder="Mensagem pública" /><textarea name="internalNote" placeholder="Motivo interno obrigatório" required /><TypedConfirmationButton>Aplicar estado</TypedConfirmationButton></form>
            <form action={manageSupportGrantAction}><input name="organizationId" type="hidden" value={organization.id} /><select name="action"><option value="grant">Conceder/substituir</option><option value="revoke">Revogar</option></select><select name="accessLevel"><option value="read_only">Somente leitura</option><option value="full">Acesso completo operacional</option></select><input name="contractReference" placeholder="Referência do contrato" /><input name="expiresAt" type="datetime-local" /><TypedConfirmationButton>Atualizar suporte</TypedConfirmationButton></form>
          </div></details> : null}</div>
      </article>)}</div>
    </section>

    {isAdmin ? <div className={styles.twoColumns}><section className={styles.panel}><header><div><UsersRound /><h2>Equipe da plataforma</h2></div></header>
      <form action={invitePlatformAccountAction} className={styles.compactForm}><input name="email" placeholder="novo@suporte.com" type="email" required /><select name="role"><option value="support">Suporte</option><option value="platform_admin">Administrador</option></select><TypedConfirmationButton>Enviar convite</TypedConfirmationButton></form>
      <div className={styles.list}>{snapshot.principals.map((principal) => <article className={styles.rowItem} key={principal.user_id}><span><strong>{principal.email}</strong><small>{principal.role} · {principal.active ? "ativo" : "inativo"}</small></span><form action={managePlatformPrincipalAction}><input name="userId" type="hidden" value={principal.user_id} /><select defaultValue={principal.role} name="role"><option value="support">Suporte</option><option value="platform_admin">Administrador</option></select><select name="action"><option value={principal.active ? "deactivate" : "activate"}>{principal.active ? "Desativar" : "Ativar"}</option><option value="change_role">Alterar papel</option><option value="revoke_invitation">Revogar convite</option></select><TypedConfirmationButton>Aplicar</TypedConfirmationButton></form></article>)}</div>
    </section><section className={styles.panel}><header><div><KeyRound /><h2>Pré-autorizar nova imobiliária</h2></div></header><form action={preauthorizeOrganizationAction} className={styles.compactForm}><input name="email" placeholder="dono@imobiliaria.com" type="email" required /><input name="action" type="hidden" value="create" /><TypedConfirmationButton>Criar autorização de 30 dias</TypedConfirmationButton></form><div className={styles.list}>{snapshot.preauthorizations.map((item) => <article className={styles.rowItem} key={item.id}><span><strong>{item.email}</strong><small>Expira {new Date(item.expires_at).toLocaleDateString("pt-BR")}</small></span><form action={preauthorizeOrganizationAction}><input name="email" type="hidden" value={item.email} /><input name="action" type="hidden" value="revoke" /><TypedConfirmationButton className={styles.danger}>Revogar</TypedConfirmationButton></form></article>)}</div></section></div> : null}

    {isAdmin ? <section className={styles.panel}><header><div><UserCog /><h2>Contas de usuários</h2></div><span>Suspensão invalida sessões; reativação não restaura preferências operacionais.</span></header><div className={styles.userGrid}>{users.map((user) => <details key={user.user_id}><summary><span><strong>{user.full_name ?? user.email}</strong><small>{user.organization_name ?? "Sem imobiliária"} · {user.membership_status ?? "sem vínculo"}</small></span><b>{user.account_suspended ? "suspenso" : user.requests_blocked ? "solicitações bloqueadas" : "normal"}</b></summary><form action={controlUserAction} className={styles.detailBody}><input name="userId" type="hidden" value={user.user_id} /><select name="action"><option value={user.account_suspended ? "reactivate" : "suspend"}>{user.account_suspended ? "Reativar conta" : "Suspender conta"}</option><option value={user.requests_blocked ? "unblock_requests" : "block_requests"}>{user.requests_blocked ? "Liberar solicitações" : "Bloquear solicitações"}</option></select><input name="publicMessage" placeholder="Mensagem pública para suspensão" /><textarea name="internalNote" placeholder="Motivo interno obrigatório" required /><TypedConfirmationButton>Aplicar à conta</TypedConfirmationButton></form></details>)}</div></section> : null}
  </main>;
}
