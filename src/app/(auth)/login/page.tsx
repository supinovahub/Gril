import type { Metadata } from "next";
import { cookies } from "next/headers";

import {
  PENDING_INVITATION_COOKIE,
  resolveAuthNext,
} from "@/lib/auth/pending-invitation";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    message?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const pageMessage =
    params.message === "senha-atualizada"
      ? "Senha atualizada. Entre novamente."
      : undefined;

  return (
    <LoginForm
      nextPath={resolveAuthNext(
        params.next,
        cookieStore.get(PENDING_INVITATION_COOKIE)?.value,
        "/app",
      )}
      pageMessage={pageMessage}
    />
  );
}
