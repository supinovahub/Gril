"use server";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  invitationGatewayPath,
  isInvitationToken,
  pendingInvitationCookieOptions,
  PENDING_INVITATION_COOKIE,
} from "@/lib/auth/pending-invitation";
import { getViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isWhatsAppConflict, requiredWhatsAppSchema } from "@/lib/whatsapp";

const zeroUuid = "00000000-0000-0000-0000-000000000000";

export type ClaimState = {
  status: "idle" | "error";
  message?: string;
  fields?: Record<string, string[]>;
};

const claimSchema = z.object({ whatsapp: requiredWhatsAppSchema });

function invitationErrorMessage(message: string | undefined) {
  if (message?.includes("email_must_be_confirmed")) {
    return "Confirme seu e-mail antes de aceitar o convite.";
  }
  if (message?.includes("invitation_email_mismatch")) {
    return "Este convite pertence a outro e-mail. Troque de conta para continuar.";
  }
  if (message?.includes("account_already_linked")) {
    return "Esta conta já está vinculada a uma imobiliária. Fale com o responsável pelo convite.";
  }
  if (message?.includes("invitation_link_invalid_or_expired")) {
    return "O convite expirou, foi revogado ou já foi utilizado. Peça um novo link.";
  }
  return "O WhatsApp foi salvo, mas não foi possível aceitar o convite agora. Tente novamente.";
}

async function clearPendingInvitation(token: string) {
  const cookieStore = await cookies();
  if (cookieStore.get(PENDING_INVITATION_COOKIE)?.value === invitationGatewayPath(token)) {
    cookieStore.delete(PENDING_INVITATION_COOKIE);
  }
}

export async function claimInvitationAction(
  token: string,
  _previous: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  void _previous;

  if (!isInvitationToken(token)) {
    return { status: "error", message: "Este convite é inválido." };
  }

  const parsed = claimSchema.safeParse({ whatsapp: formData.get("whatsapp") });
  if (!parsed.success) {
    return { status: "error", fields: parsed.error.flatten().fieldErrors };
  }

  const viewer = await getViewer();
  if (!viewer) {
    return { status: "error", message: "Entre na conta antes de aceitar o convite." };
  }

  const supabase = await createClient();
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ whatsapp_e164: parsed.data.whatsapp })
    .eq("user_id", viewer.userId);

  if (profileError) {
    return {
      status: "error",
      message: isWhatsAppConflict(profileError)
        ? "Este número já está em uso. Informe outro WhatsApp ou fale com o suporte."
        : "Não foi possível salvar o WhatsApp. Confira o número e tente novamente.",
    };
  }

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
    if (error?.message.includes("invitation_link_invalid_or_expired")) {
      await clearPendingInvitation(token);
    }
    return { status: "error", message: invitationErrorMessage(error?.message) };
  }

  await clearPendingInvitation(token);
  redirect("/app");
}

export async function switchInvitationAccountAction(token: string) {
  if (!isInvitationToken(token)) redirect("/login");

  const gatewayPath = invitationGatewayPath(token);
  const cookieStore = await cookies();
  cookieStore.set(
    PENDING_INVITATION_COOKIE,
    gatewayPath,
    pendingInvitationCookieOptions(),
  );

  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect(`/login?next=${encodeURIComponent(gatewayPath)}`);
}
