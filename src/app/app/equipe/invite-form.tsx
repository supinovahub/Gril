"use client";

import { Link2, Send } from "lucide-react";
import { useActionState, useState } from "react";

import { createInvitationAction, type InviteState } from "./actions";
import { CopyButton } from "./copy-button";
import styles from "./team.module.css";

const initialState: InviteState = { status: "idle" };

export function InviteForm({
  operations,
  canInviteManager,
}: {
  operations: { id: string; name: string }[];
  canInviteManager: boolean;
}) {
  const [kind, setKind] = useState<"general" | "individual">("individual");
  const [state, action, pending] = useActionState(
    createInvitationAction,
    initialState,
  );

  return (
    <form action={action} className={styles.inviteForm} noValidate>
      <div className={styles.segmented}>
        <label>
          <input
            checked={kind === "individual"}
            name="kind"
            onChange={() => setKind("individual")}
            type="radio"
            value="individual"
          />
          Convite individual
        </label>
        <label>
          <input
            checked={kind === "general"}
            name="kind"
            onChange={() => setKind("general")}
            type="radio"
            value="general"
          />
          Link geral
        </label>
      </div>

      {state.message ? (
        <p className={`${styles.feedback} ${state.status === "success" ? styles.success : ""}`}>
          {state.message}
        </p>
      ) : null}

      {state.inviteUrl ? (
        <div className={styles.generatedLink}>
          <Link2 size={16} />
          <code>{state.inviteUrl}</code>
          <CopyButton value={state.inviteUrl} />
        </div>
      ) : null}

      <div className={styles.formGrid}>
        {kind === "general" ? (
          <>
            <input name="role" type="hidden" value="broker" />
            <input name="operationId" type="hidden" value="" />
          </>
        ) : (
          <input name="maxUses" type="hidden" value="1" />
        )}

        {kind === "individual" ? (
          <div className={styles.fieldWide}>
            <label htmlFor="invite-email">E-mail</label>
            <input id="invite-email" name="email" type="email" placeholder="corretor@imobiliaria.com.br" />
            {state.fields?.email?.map((error) => <small key={error}>{error}</small>)}
          </div>
        ) : null}

        <div className={styles.field}>
          <label htmlFor="invite-role">Papel</label>
          <select id="invite-role" name="role" disabled={kind === "general"}>
            <option value="broker">Corretor</option>
            {canInviteManager ? <option value="manager">Gestor</option> : null}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="invite-operation">Operação</label>
          <select id="invite-operation" name="operationId" disabled={kind === "general"}>
            <option value="">Todas / definir depois</option>
            {operations.map((operation) => (
              <option key={operation.id} value={operation.id}>{operation.name}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="invite-expires">Validade</label>
          <select id="invite-expires" name="expiresDays" defaultValue={kind === "general" ? "30" : "7"}>
            <option value="1">1 dia</option>
            <option value="7">7 dias</option>
            <option value="15">15 dias</option>
            <option value="30">30 dias</option>
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="invite-uses">Usos máximos</label>
          <input
            id="invite-uses"
            name="maxUses"
            type="number"
            min="1"
            max="1000"
            defaultValue={kind === "general" ? 250 : 1}
            disabled={kind === "individual"}
          />
        </div>
      </div>

      <p className={styles.formHint}>
        {kind === "general"
          ? "O link geral nunca libera dados: cada cadastro entra como aguardando aprovação."
          : "O convite individual exige o mesmo e-mail confirmado e pode ativar o acesso previsto."}
      </p>

      <button className={styles.primaryButton} disabled={pending} type="submit">
        <Send size={15} /> {pending ? "Criando…" : "Criar convite"}
      </button>
    </form>
  );
}
