import { MessageCircleWarning } from "lucide-react";
import { redirect } from "next/navigation";

import { signOutAction } from "@/app/(auth)/actions";
import { requireViewer } from "@/lib/auth/session";
import { RequiredWhatsappForm } from "./required-whatsapp-form";
import styles from "./required-whatsapp.module.css";

export default async function RequiredWhatsappPage() {
  const viewer = await requireViewer();

  if (viewer.accessBlock && !viewer.supportAccess) redirect("/acesso-suspenso");
  if (viewer.platformRole && !viewer.membership) redirect("/platform");
  if (!viewer.membership) redirect("/onboarding");
  if (viewer.membership.status !== "active" || !viewer.organization) {
    redirect("/aguardando-aprovacao");
  }
  if (viewer.membership.role === "owner" || viewer.profile?.whatsapp_e164) {
    redirect("/app");
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <MessageCircleWarning size={28} aria-hidden="true" />
        <p className={styles.eyebrow}>Ação obrigatória</p>
        <h1>Cadastre seu WhatsApp operacional</h1>
        <p className={styles.lead}>
          Gestores e corretores precisam de um número válido e exclusivo para participar de distribuições, receber ofertas e acessar a operação.
        </p>
        <RequiredWhatsappForm initialWhatsapp={viewer.profile?.whatsapp_e164 ?? "+55"} />
        <form action={signOutAction}>
          <button className={styles.signOut} type="submit">Sair da conta</button>
        </form>
      </section>
    </main>
  );
}
