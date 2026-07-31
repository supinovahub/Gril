import { UserRound } from "lucide-react";

import { requireActiveViewer } from "@/lib/auth/session";
import { ProfileForm } from "./profile-form";
import styles from "./profile.module.css";

export default async function ProfilePage() {
  const viewer = await requireActiveViewer();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p>Conta e comunicação</p>
        <h1>Meu perfil</h1>
        <p>Mantenha os dados usados pela operação atualizados.</p>
      </header>

      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <UserRound size={19} aria-hidden="true" />
          <h2>Dados pessoais</h2>
        </header>
        <ProfileForm
          fullName={viewer.profile?.full_name ?? ""}
          email={viewer.email}
          whatsapp={viewer.profile?.whatsapp_e164 ?? ""}
        />
      </section>
    </div>
  );
}
