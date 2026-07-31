import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "@/lib/supabase/env";

const publicPrefixes = [
  "/auth",
  "/convite",
  "/login",
  "/cadastro",
  "/recuperar-senha",
  "/redefinir-senha",
];

function isPublicPath(pathname: string) {
  return pathname === "/" || publicPrefixes.some((prefix) => pathname.startsWith(prefix));
}

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
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return response;
}
