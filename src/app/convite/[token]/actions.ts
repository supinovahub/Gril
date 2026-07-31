"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";

import { getViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const zeroUuid = "00000000-0000-0000-0000-000000000000";

export type ClaimState = {
  status: "idle" | "error";
  message?: string;
};

export async function claimInvitationAction(
  token: string,
  _previous: ClaimState,
  _formData: FormData,
): Promise<ClaimState> {
  void _previous;
  void _formData;

  if (!/^[A-Za-z0-9_-]{32,160}$/.test(token)) {
    return { status: "error", message: "Este convite é inválido." };
  }

  const viewer = await getViewer();
  if (!viewer) {
    return { status: "error", message: "Entre na conta antes de aceitar o convite." };
  }

  const supabase = await createClient();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data: claim, error } = await supabase
    .from("invitation_claims")
    .insert({
      invitation_link_id: zeroUuid,
      org_id: zeroUuid,
      token_hash: tokenHash,
      user_id: viewer.userId,
    })
    .select("org_id")
    .single();

  if (error || !claim) {
    return {
      status: "error",
      message: "O convite expirou, já foi usado ou não corresponde a esta conta.",
    };
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("status")
    .eq("org_id", claim.org_id)
    .eq("user_id", viewer.userId)
    .maybeSingle();

  redirect(membership?.status === "active" ? "/app" : "/aguardando-aprovacao");
}
