import { LockKeyhole, MessageCircleMore, ShieldCheck } from "lucide-react";

import styles from "./auth.module.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.shell}>
      <section className={styles.context} aria-label="Contexto do produto">
        <div className={styles.brand}>
          <span className={styles.brandMark}>G</span>
          <span>Gril</span>
        </div>

        <div className={styles.contextCopy}>
          <p className={styles.eyebrow}>Workspace comercial</p>
          <h1>A operação começa pela próxima conversa.</h1>
          <p>
            Atendimento, agenda e decisões reunidos em uma única rotina para a imobiliária.
          </p>
        </div>

        <ul className={styles.trustList}>
          <li>
            <ShieldCheck size={18} aria-hidden="true" />
            Dados isolados por imobiliária
          </li>
          <li>
            <LockKeyhole size={18} aria-hidden="true" />
            Acessos validados no banco
          </li>
          <li>
            <MessageCircleMore size={18} aria-hidden="true" />
            WhatsApp conectado ao atendimento
          </li>
        </ul>

        <p className={styles.environment}>Acesso seguro · operação rastreável</p>
      </section>

      <section className={styles.formSide}>{children}</section>
    </main>
  );
}
