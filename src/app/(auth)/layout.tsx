import { LockKeyhole, MessageCircleMore, ShieldCheck } from "lucide-react";

import styles from "./auth.module.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.shell}>
      <section className={styles.context} aria-label="Contexto do produto">
        <div className={styles.brand}>
          <span className={styles.brandMark}>P</span>
          <span>Pedro</span>
        </div>

        <div className={styles.contextCopy}>
          <p className={styles.eyebrow}>Operação imobiliária</p>
          <h1>Conversas, equipe e decisões no mesmo ritmo.</h1>
          <p>
            A base começa pelo essencial: identidade confirmada, acesso aprovado e
            dados isolados por operação.
          </p>
        </div>

        <ul className={styles.trustList}>
          <li>
            <ShieldCheck size={18} aria-hidden="true" />
            Acesso por organização e operação
          </li>
          <li>
            <LockKeyhole size={18} aria-hidden="true" />
            Papéis validados no banco
          </li>
          <li>
            <MessageCircleMore size={18} aria-hidden="true" />
            WhatsApp não é usado para login
          </li>
        </ul>

        <p className={styles.environment}>MVP interno · ambiente de desenvolvimento</p>
      </section>

      <section className={styles.formSide}>{children}</section>
    </main>
  );
}
