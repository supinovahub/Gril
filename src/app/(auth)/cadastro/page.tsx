import type { Metadata } from "next";

import { safeNextPath } from "@/lib/auth/safe-next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Criar conta" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string }>;
}) {
  const { next, email } = await searchParams;
  return (
    <RegisterForm initialEmail={email?.slice(0, 320) ?? ""} nextPath={safeNextPath(next, "/onboarding")} />
  );
}
