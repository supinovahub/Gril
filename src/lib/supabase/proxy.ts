import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/database.types";
import {
  PENDING_INVITATION_COOKIE,
  resolveAuthNext,
} from "@/lib/auth/pending-invitation";
import { isPublicPath } from "@/lib/routing/public-path";
import { supabaseEnv } from "@/lib/supabase/env";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    supabaseEnv.url,
    supabaseEnv.publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });

          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const hasSession = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  if (!hasSession && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const isAuthEntry = ["/login", "/cadastro", "/recuperar-senha"].some(
    (path) => pathname.startsWith(path),
  );

  if (hasSession && isAuthEntry) {
    const target = resolveAuthNext(
      request.nextUrl.searchParams.get("next"),
      request.cookies.get(PENDING_INVITATION_COOKIE)?.value,
      "/app",
    );
    const redirectResponse = NextResponse.redirect(new URL(target, request.url));
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  return response;
}
