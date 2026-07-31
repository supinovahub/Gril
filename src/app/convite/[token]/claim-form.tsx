"use client";

import { ArrowRight } from "lucide-react";
import { useActionState } from "react";

import { claimInvitationAction, type ClaimState } from "./actions";
import styles from "./invite.module.css";

const initialState: ClaimState = { status: "idle" };

export function ClaimForm({ token }: { token: string }) {
  const action = claimInvitationAction.bind(null, token);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      {state.message ? <p className={styles.error} role="alert">{state.message}</p> : null}
      <button className={styles.primaryButton} disabled={pending} type="submit">
        {pending ? "Validando…" : "Aceitar convite"}
        {!pending ? <ArrowRight size={17} aria-hidden="true" /> : null}
      </button>
    </form>
  );
}
