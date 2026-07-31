import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { getViewer } from "@/lib/auth/session";
import { ClaimForm } from "./claim-form";
import styles from "./invite.module.css";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const viewer = await getViewer();
  const nextPath = `/convite/${encodeURIComponent(token)}`;

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.brand}>Pedro</div>
        <p className={styles.eyebrow}>Convite de acesso</p>
        <h1>Você foi convidado para uma operação</h1>
        <p className={styles.lead}>
          Confirme a conta que usará no dia a dia. Links gerais ainda exigem
          aprovação de um dono ou gestor antes de liberar qualquer dado.
        </p>

        {viewer ? (
          <>
            <p className={styles.notice}>Conta atual: <strong>{viewer.email}</strong></p>
            <ClaimForm token={token} />
          </>
        ) : (
          <div className={styles.accountActions}>
            <Link className={styles.primaryButton} href={`/login?next=${encodeURIComponent(nextPath)}`}>
              Entrar para aceitar <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link className={styles.secondaryLink} href={`/cadastro?next=${encodeURIComponent(nextPath)}`}>
              Criar uma conta
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
