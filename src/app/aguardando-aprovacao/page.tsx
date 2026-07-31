import { Clock3, ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";

import { signOutAction } from "@/app/(auth)/actions";
import { requireViewer } from "@/lib/auth/session";
import styles from "./access.module.css";

export default async function PendingApprovalPage() {
  const viewer = await requireViewer();

  if (viewer.membership?.status === "active") {
    redirect("/app");
  }
  if (!viewer.membership) {
    redirect("/onboarding");
  }

  const status = viewer.membership?.status ?? "sem vínculo";
  const isPending = status === "pending";

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.brand}>
          <span className={styles.mark}>P</span>
          Pedro
        </div>

        <div className={styles.statusIcon}>
          {isPending ? <Clock3 aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
        </div>

        <h1>{isPending ? "Seu cadastro aguarda aprovação" : "Acesso ainda não liberado"}</h1>
        <p className={styles.lead}>
          {isPending
            ? "Um dono ou gestor autorizado precisa revisar seu cadastro, definir o papel e aprovar o acesso. Até lá, nenhum dado da imobiliária fica visível."
            : "Entre pelo convite recebido da imobiliária. Cadastros espontâneos permanecem isolados até que a equipe associe e aprove a conta."}
        </p>

        <div className={styles.details}>
          <div className={styles.detail}>
            <span>Conta</span>
            <strong>{viewer.email}</strong>
          </div>
          <div className={styles.detail}>
            <span>Status</span>
            <strong>{isPending ? "Aguardando aprovação" : "Sem acesso"}</strong>
          </div>
        </div>

        <div className={styles.actions}>
          <p>Você pode fechar esta página e voltar pelo mesmo endereço.</p>
          <form action={signOutAction}>
            <button className={styles.signOut} type="submit">Sair da conta</button>
          </form>
        </div>
      </section>
    </main>
  );
}
