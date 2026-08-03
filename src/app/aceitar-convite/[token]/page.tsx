import { ArrowRight, Building2, CalendarClock, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { invitationGatewayPath } from "@/lib/auth/pending-invitation";
import { getViewer } from "@/lib/auth/session";
import { getInvitationPreview } from "@/lib/invitations/preview";
import { ClaimForm } from "./claim-form";
import { switchInvitationAccountAction } from "./actions";
import styles from "./invite.module.css";

const roleLabels = { manager: "Gestor", broker: "Corretor" } as const;

const terminalMessages = {
  expired: "Este convite expirou. Peça um novo link ao responsável pela imobiliária.",
  invalid: "Este convite é inválido. Confira o link ou peça um novo ao responsável.",
  revoked: "Este convite foi revogado. Peça outro link ao responsável pela imobiliária.",
  used: "Este convite já foi utilizado e não pode ser aceito novamente.",
} as const;

export default async function InvitationAcceptancePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [viewer, preview] = await Promise.all([
    getViewer(),
    getInvitationPreview(token),
  ]);
  const gatewayPath = invitationGatewayPath(token);
  const isTerminal = preview.invitation_status !== "active";
  const linkedMembership = viewer?.membership
    && ["pending", "active", "suspended"].includes(viewer.membership.status);

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.brand}>Pedro</div>
        <p className={styles.eyebrow}>Convite individual</p>
        <h1>{isTerminal ? "Não foi possível abrir o convite" : "Você recebeu um acesso"}</h1>

        {isTerminal ? (
          <>
            <p className={styles.lead}>
              {terminalMessages[preview.invitation_status as keyof typeof terminalMessages]}
            </p>
            <Link className={styles.secondaryLink} href="/login">Ir para o login</Link>
          </>
        ) : (
          <>
            <div className={styles.summary}>
              <span><Building2 size={17} aria-hidden="true" />{preview.organization_name}</span>
              <span><ShieldCheck size={17} aria-hidden="true" />{roleLabels[preview.invited_role!]}</span>
              <span>
                <CalendarClock size={17} aria-hidden="true" />
                Válido até {new Date(preview.expires_at!).toLocaleDateString("pt-BR")}
              </span>
            </div>

            {!viewer ? (
              <div className={styles.accountActions}>
                <p className={styles.lead}>
                  Entre ou crie sua conta. O convite continuará disponível depois da confirmação do e-mail.
                </p>
                <Link className={styles.primaryButton} href={`/login?next=${encodeURIComponent(gatewayPath)}`}>
                  Entrar para continuar <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <Link className={styles.secondaryLink} href={`/cadastro?next=${encodeURIComponent(gatewayPath)}`}>
                  Criar uma conta
                </Link>
              </div>
            ) : !preview.email_matches ? (
              <div className={styles.accountActions}>
                <p className={styles.notice}>
                  A conta atual, <strong>{viewer.email}</strong>, não corresponde ao convite enviado para <strong>{preview.invited_email_masked}</strong>.
                </p>
                <form action={switchInvitationAccountAction.bind(null, token)}>
                  <button className={styles.primaryButton} type="submit">Trocar de conta</button>
                </form>
              </div>
            ) : linkedMembership ? (
              <div className={styles.accountActions}>
                <p className={styles.notice}>
                  Esta conta já possui um vínculo com uma imobiliária. Uma conta aceita somente um vínculo ativo; fale com o responsável se precisar usar outro acesso.
                </p>
                <form action={switchInvitationAccountAction.bind(null, token)}>
                  <button className={styles.secondaryButton} type="submit">Usar outra conta</button>
                </form>
              </div>
            ) : (
              <>
                <p className={styles.notice}>Conta confirmada: <strong>{viewer.email}</strong></p>
                {preview.operation_name ? (
                  <p className={styles.operation}>Operação inicial: <strong>{preview.operation_name}</strong></p>
                ) : null}
                <ClaimForm
                  initialWhatsapp={viewer.profile?.whatsapp_e164 ?? "+55"}
                  token={token}
                />
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
