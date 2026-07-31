import type { Metadata } from "next";

import { safeNextPath } from "@/lib/auth/safe-next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Criar conta" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <RegisterForm nextPath={safeNextPath(next, "/aguardando-aprovacao")} />
  );
}
