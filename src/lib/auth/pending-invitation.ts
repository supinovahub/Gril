import { safeNextPath } from "./safe-next";

export const PENDING_INVITATION_COOKIE = "gril_pending_invitation";
export const INVITATION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
export const INVITATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,160}$/;

export function isInvitationToken(value: string) {
  return INVITATION_TOKEN_PATTERN.test(value);
}

export function invitationGatewayPath(token: string) {
  return `/convite/${encodeURIComponent(token)}`;
}

export function invitationViewPath(token: string) {
  return `/aceitar-convite/${encodeURIComponent(token)}`;
}

export function pendingInvitationPath(value: string | null | undefined) {
  if (!value) return null;

  const match = /^\/convite\/([A-Za-z0-9_-]{32,160})$/.exec(value);
  return match ? invitationGatewayPath(match[1]) : null;
}

export function resolveAuthNext(
  explicitNext: string | null | undefined,
  pendingInvitation: string | null | undefined,
  fallback: string,
) {
  const explicit = safeNextPath(explicitNext, "");
  if (explicit) return explicit;
  return pendingInvitationPath(pendingInvitation) ?? fallback;
}

export function pendingInvitationCookieOptions(maxAge = INVITATION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    maxAge: Math.max(1, Math.min(INVITATION_MAX_AGE_SECONDS, maxAge)),
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}
