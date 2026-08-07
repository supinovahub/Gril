import { NextResponse, type NextRequest } from "next/server";

import {
  isInvitationGatewayPath,
  PENDING_INVITATION_COOKIE,
  resolveAuthNext,
} from "@/lib/auth/pending-invitation";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = resolveAuthNext(
    request.nextUrl.searchParams.get("next"),
    request.cookies.get(PENDING_INVITATION_COOKIE)?.value,
    "/onboarding",
  );

  if (code) {
    const supabase = await createClient();
    if (isInvitationGatewayPath(next)) {
      await supabase.auth.signOut({ scope: "local" });
    }
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(new URL(next, request.url));
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
  }

  const response = NextResponse.redirect(new URL("/login?error=callback", request.url));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
