import { Building2, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { signOutAction } from "@/app/(auth)/actions";
import { requireViewer } from "@/lib/auth/session";
import { bootstrapOrganizationAction } from "./actions";
import styles from "./onboarding.module.css";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const viewer = await requireViewer();
  const feedback = await searchParams;
  if (viewer.membership?.status === "active") redirect("/app");
  if (viewer.membership) redirect("/aguardando-aprovacao");

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.brand}><span>P</span> Pedro</div>
        <header>
          <Building2 aria-hidden="true" />
          <div><p>Primeira configuração</p><h1>Crie sua imobiliária e operação</h1></div>
        </header>
        <p className={styles.lead}>Você será cadastrado como dono. A organização, a operação padrão e os controles de segurança serão criados juntos.</p>
        {feedback.erro ? <p className={styles.error}>{feedback.erro}</p> : null}
        <form action={bootstrapOrganizationAction}>
          <label><span>Nome da imobiliária</span><input autoComplete="organization" maxLength={120} name="organizationName" required /></label>
          <label><span>Nome da operação</span><input defaultValue="Operação principal" maxLength={120} name="operationName" required /></label>
          <label><span>Fuso horário</span><select defaultValue="America/Sao_Paulo" name="timezone"><option value="America/Sao_Paulo">Brasília — America/Sao_Paulo</option><option value="America/Manaus">Manaus — America/Manaus</option><option value="America/Cuiaba">Cuiabá — America/Cuiaba</option><option value="America/Rio_Branco">Rio Branco — America/Rio_Branco</option></select></label>
          <button type="submit">Criar organização e continuar</button>
        </form>
        <p className={styles.safety}><ShieldCheck size={16} /> O banco impede que a mesma conta crie duas organizações por engano.</p>
        <form action={signOutAction}><button className={styles.signOut} type="submit">Sair e usar outra conta</button></form>
      </section>
    </main>
  );
}
