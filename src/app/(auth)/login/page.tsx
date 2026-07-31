import type { Metadata } from "next";

import { safeNextPath } from "@/lib/auth/safe-next";
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
  const params = await searchParams;
  const pageMessage =
    params.message === "senha-atualizada"
      ? "Senha atualizada. Entre novamente."
      : undefined;

  return (
    <LoginForm
      nextPath={safeNextPath(params.next)}
      pageMessage={pageMessage}
    />
  );
}
