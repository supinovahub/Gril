import { NextResponse, type NextRequest } from "next/server";

import {
  invitationGatewayPath,
  invitationViewPath,
  INVITATION_MAX_AGE_SECONDS,
  isInvitationToken,
  pendingInvitationCookieOptions,
  PENDING_INVITATION_COOKIE,
} from "@/lib/auth/pending-invitation";
import { getInvitationPreview } from "@/lib/invitations/preview";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const response = NextResponse.redirect(new URL(invitationViewPath(token), request.url));

  if (!isInvitationToken(token)) {
    return response;
  }

  const preview = await getInvitationPreview(token);
  const gatewayPath = invitationGatewayPath(token);

  if (preview.invitation_status === "active" && preview.expires_at) {
    const remainingSeconds = Math.floor(
      (new Date(preview.expires_at).getTime() - Date.now()) / 1000,
    );
    response.cookies.set(
      PENDING_INVITATION_COOKIE,
      gatewayPath,
      pendingInvitationCookieOptions(
        Math.min(INVITATION_MAX_AGE_SECONDS, Math.max(1, remainingSeconds)),
      ),
    );
  } else if (request.cookies.get(PENDING_INVITATION_COOKIE)?.value === gatewayPath) {
    response.cookies.delete(PENDING_INVITATION_COOKIE);
  }

  return response;
}
