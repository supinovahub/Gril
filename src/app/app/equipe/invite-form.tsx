"use client";

import { Link2, Send } from "lucide-react";
import { useActionState } from "react";

import { createInvitationAction, type InviteState } from "./actions";
import { CopyButton } from "./copy-button";
import styles from "./team.module.css";

const initialState: InviteState = { status: "idle" };

export function InviteForm({ operations, canInviteManager }: { operations: { id: string; name: string }[]; canInviteManager: boolean }) {
  const [state, action, pending] = useActionState(createInvitationAction, initialState);
  return (
    <form action={action} className={styles.inviteForm} noValidate>
      {state.message ? <p className={`${styles.feedback} ${state.status === "success" ? styles.success : ""}`}>{state.message}</p> : null}
      {state.inviteUrl ? <div className={styles.generatedLink}><Link2 size={16} /><code>{state.inviteUrl}</code><CopyButton value={state.inviteUrl} /></div> : null}
      <div className={styles.formGrid}>
        <div className={styles.fieldWide}><label htmlFor="invite-email">E-mail confirmado do convidado</label><input id="invite-email" name="email" type="email" placeholder="corretor@imobiliaria.com.br" required />{state.fields?.email?.map((error) => <small key={error}>{error}</small>)}</div>
        <div className={styles.field}><label htmlFor="invite-role">Papel</label><select id="invite-role" name="role"><option value="broker">Corretor</option>{canInviteManager ? <option value="manager">Gestor</option> : null}</select></div>
        <div className={styles.field}><label htmlFor="invite-operation">Operação do corretor</label><select id="invite-operation" name="operationId"><option value="">Selecione para corretor</option>{operations.map((operation) => <option key={operation.id} value={operation.id}>{operation.name}</option>)}</select></div>
      </div>
      <p className={styles.formHint}>Convite individual, vinculado ao e-mail, usado uma vez e válido por 7 dias. Links gerais foram desativados.</p>
      <button className={styles.primaryButton} disabled={pending} type="submit"><Send size={15} /> {pending ? "Criando…" : "Criar convite individual"}</button>
    </form>
  );
}
