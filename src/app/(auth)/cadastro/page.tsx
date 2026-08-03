import type { Metadata } from "next";
import { cookies } from "next/headers";

import {
  PENDING_INVITATION_COOKIE,
  resolveAuthNext,
} from "@/lib/auth/pending-invitation";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Criar conta" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string }>;
}) {
  const [{ next, email }, cookieStore] = await Promise.all([searchParams, cookies()]);
  return (
    <RegisterForm
      initialEmail={email?.slice(0, 320) ?? ""}
      nextPath={resolveAuthNext(
        next,
        cookieStore.get(PENDING_INVITATION_COOKIE)?.value,
        "/onboarding",
      )}
    />
  );
}
