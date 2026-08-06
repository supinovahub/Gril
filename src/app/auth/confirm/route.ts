import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import {
  isInvitationGatewayPath,
  PENDING_INVITATION_COOKIE,
  resolveAuthNext,
} from "@/lib/auth/pending-invitation";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const next = resolveAuthNext(
    request.nextUrl.searchParams.get("next"),
    request.cookies.get(PENDING_INVITATION_COOKIE)?.value,
    "/aguardando-aprovacao",
  );

  if (tokenHash && type) {
    const supabase = await createClient();
    if (isInvitationGatewayPath(next)) {
      await supabase.auth.signOut({ scope: "local" });
    }
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      const response = NextResponse.redirect(new URL(next, request.url));
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
  }

  const response = NextResponse.redirect(new URL("/login?error=confirmacao", request.url));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
