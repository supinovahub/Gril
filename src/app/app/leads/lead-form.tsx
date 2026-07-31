import { ArrowRight, Bot, Save, UserRoundCheck } from "lucide-react";

import type { Tables } from "@/lib/database.types";
import { createLeadAction } from "./actions";
import styles from "./leads.module.css";

export function LeadForm({
  operations,
  memberships,
  currentMembershipId,
}: {
  operations: Tables<"operations">[];
  memberships: Pick<Tables<"memberships">, "id" | "role">[];
  currentMembershipId: string;
}) {
  return (
    <form action={createLeadAction} className={styles.createForm}>
      <div className={styles.formIntro}>
        <div>
          <p className={styles.eyebrow}>Entrada manual</p>
          <h2>Novo lead</h2>
        </div>
        <span>Deduplicação automática por E.164</span>
      </div>

      <div className={styles.formGrid}>
        <label>
          <span>Nome</span>
          <input name="name" placeholder="Nome do contato" required />
        </label>
        <label>
          <span>WhatsApp</span>
          <input name="phone" placeholder="(11) 99999-9999" required />
        </label>
        <label>
          <span>Origem</span>
          <input defaultValue="manual" name="source" required />
        </label>
        <label>
          <span>Operação</span>
          <select name="operationId" required>
            {operations.map((operation) => (
              <option key={operation.id} value={operation.id}>{operation.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Responsável</span>
          <select name="assignedMembershipId" defaultValue={currentMembershipId}>
            <option value="">Sem responsável</option>
            {memberships.map((membership) => (
              <option key={membership.id} value={membership.id}>
                {membership.id === currentMembershipId ? "Eu" : `${membership.role} · ${membership.id.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.fullField}>
          <span>Contexto para Pedro</span>
          <textarea name="aiContext" placeholder="Informações que podem orientar o atendimento." rows={3} />
        </label>
        <label className={styles.fullField}>
          <span>Nota interna</span>
          <textarea name="internalNote" placeholder="Nunca é enviada ao modelo." rows={3} />
        </label>
      </div>

      <label className={styles.checkField}>
        <input name="shareContextWithBroker" type="checkbox" />
        Compartilhar o contexto de atendimento com o corretor atribuído
      </label>

      <div className={styles.actionChoice}>
        <label><input defaultChecked name="desiredAction" type="radio" value="register" /><Save size={16} /> Somente registrar</label>
        <label><input name="desiredAction" type="radio" value="assume" /><UserRoundCheck size={16} /> Assumir</label>
        <label><input name="desiredAction" type="radio" value="request_pedro" /><Bot size={16} /> Solicitar Pedro</label>
      </div>
      <label className={styles.checkField}>
        <input name="authorizationConfirmed" type="checkbox" />
        Confirmo autorização para iniciar mensagem automática quando “Solicitar Pedro” for usado
      </label>

      <button className={styles.primaryButton} type="submit">
        Salvar lead <ArrowRight size={16} />
      </button>
    </form>
  );
}

