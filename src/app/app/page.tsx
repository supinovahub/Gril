import {
  Building2,
  CheckCircle2,
  Link2,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";

import { TypedConfirmationButton } from "@/components/typed-confirmation-button";
import { canManageTeam, requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { purgeHomologationContextAction } from "./homologation-actions";
import styles from "./dashboard.module.css";

type HomologationPreview = {
  eligible: boolean;
  blocked: string[];
  counts: Record<string, number>;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ erro?: string; limpeza?: string }>;
}) {
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const managesTeam = canManageTeam(viewer);
  const feedback: { erro?: string; limpeza?: string } = searchParams ? await searchParams : {};

  let activeMembers = 1;
  let pendingMembers = 0;
  let activeInvites = 0;
  let homologationPreview: HomologationPreview | null = null;

  if (managesTeam) {
    const [activeResult, pendingResult, inviteResult, previewResult] = await Promise.all([
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
      supabase.rpc("preview_homologation_context", { p_org_id: viewer.organization!.id }),
    ]);

    activeMembers = activeResult.count ?? 0;
    pendingMembers = pendingResult.count ?? 0;
    activeInvites = inviteResult.count ?? 0;
    if (!previewResult.error && previewResult.data) {
      homologationPreview = previewResult.data as unknown as HomologationPreview;
    }
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

      {feedback.erro ? <p className={styles.feedbackError}>{feedback.erro}</p> : null}
      {feedback.limpeza === "concluida" ? <p className={styles.feedbackSuccess}>Contexto HML- limpo. Auditoria e configurações foram preservadas.</p> : null}
      {feedback.limpeza === "concluida-com-arquivos-pendentes" ? <p className={styles.feedbackWarning}>Contexto HML- limpo no banco, mas alguns arquivos não puderam ser removidos agora. Revise a auditoria e a retenção.</p> : null}
      {feedback.limpeza === "nenhum-contexto-elegivel" ? <p className={styles.feedbackSuccess}>Nenhum contexto HML- elegível foi encontrado.</p> : null}

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

      {managesTeam ? (
        <section className={styles.cleanupPanel} aria-labelledby="homologation-cleanup-title">
          <div>
            <p className={styles.eyebrow}>Operação protegida</p>
            <h2 id="homologation-cleanup-title">Limpar contexto de homologação</h2>
            <p>Remove somente registros de teste com prefixo <code>HML-</code> desta imobiliária: leads, conversas, mensagens, chamadas e efeitos pendentes. Configurações, equipe e auditoria ficam preservadas.</p>
          </div>
          {homologationPreview ? (
            <div className={styles.cleanupBody}>
              <dl className={styles.cleanupCounts}>
                <div><dt>Contatos</dt><dd>{homologationPreview.counts.contacts ?? 0}</dd></div>
                <div><dt>Oportunidades</dt><dd>{homologationPreview.counts.opportunities ?? 0}</dd></div>
                <div><dt>Conversas</dt><dd>{homologationPreview.counts.conversations ?? 0}</dd></div>
                <div><dt>Mensagens</dt><dd>{homologationPreview.counts.messages ?? 0}</dd></div>
                <div><dt>Chamadas</dt><dd>{homologationPreview.counts.calls ?? 0}</dd></div>
                <div><dt>Jobs</dt><dd>{homologationPreview.counts.scheduled_jobs ?? 0}</dd></div>
              </dl>
              {homologationPreview.blocked?.length ? (
                <div className={styles.cleanupBlocked}>
                  <strong>Limpeza bloqueada por segurança</strong>
                  <ul>{homologationPreview.blocked.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                </div>
              ) : homologationPreview.eligible ? (
                <form action={purgeHomologationContextAction} className={styles.cleanupAction}>
                  <p>Preview atualizado. A execução é limitada a 20 contatos e exige digitar exatamente <code>CONFIRMAR AÇÃO</code>.</p>
                  <TypedConfirmationButton description="Somente registros HML- desta imobiliária serão removidos. Configurações, equipe e auditoria serão preservadas." title="Limpar contexto de homologação">Limpar contexto HML-</TypedConfirmationButton>
                </form>
              ) : (
                <p className={styles.cleanupEmpty}>Nenhum registro HML- elegível para limpar.</p>
              )}
            </div>
          ) : (
            <p className={styles.cleanupEmpty}>Não foi possível carregar o preview. A ação ficará indisponível até a verificação funcionar.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
