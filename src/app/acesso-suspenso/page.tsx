import { ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";

import { signOutAction } from "@/app/(auth)/actions";
import { requireViewer } from "@/lib/auth/session";
import styles from "./suspended.module.css";

export default async function SuspendedAccessPage() {
  const viewer = await requireViewer();
  if (!viewer.accessBlock) redirect(viewer.platformRole ? "/platform" : "/app");

  const archived = viewer.accessBlock.type === "archived";
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.mark}><ShieldAlert aria-hidden="true" /></div>
        <p className={styles.eyebrow}>Controle de acesso</p>
        <h1>{archived ? "Organização arquivada" : "Acesso temporariamente suspenso"}</h1>
        <p className={styles.message}>
          {viewer.accessBlock.message ?? "O acesso desta conta ou organização está temporariamente indisponível. Fale com o responsável pela plataforma."}
        </p>
        <dl><div><dt>Conta</dt><dd>{viewer.email}</dd></div><div><dt>Status</dt><dd>{viewer.accessBlock.type}</dd></div></dl>
        <form action={signOutAction}><button type="submit">Sair da conta</button></form>
      </section>
    </main>
  );
}
