import "server-only";

import { createHash } from "node:crypto";

import { isInvitationToken } from "@/lib/auth/pending-invitation";
import { createClient } from "@/lib/supabase/server";

export type InvitationPreview = {
  invitation_status: "active" | "expired" | "invalid" | "revoked" | "used";
  organization_name: string | null;
  invited_role: "manager" | "broker" | null;
  expires_at: string | null;
  invited_email_masked: string | null;
  email_matches: boolean;
  operation_name: string | null;
};

const invalidPreview: InvitationPreview = {
  invitation_status: "invalid",
  organization_name: null,
  invited_role: null,
  expires_at: null,
  invited_email_masked: null,
  email_matches: false,
  operation_name: null,
};

export async function getInvitationPreview(token: string): Promise<InvitationPreview> {
  if (!isInvitationToken(token)) return invalidPreview;

  const supabase = await createClient();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data, error } = await supabase.rpc("invitation_preview", {
    p_token_hash: tokenHash,
  });

  if (error || !data?.[0]) return invalidPreview;
  return data[0] as InvitationPreview;
}
