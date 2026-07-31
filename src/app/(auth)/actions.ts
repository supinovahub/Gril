"use server";

import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth/safe-next";
import {
  emailSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type AuthActionState,
} from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

function fieldErrors(error: { flatten: () => { fieldErrors: Record<string, string[]> } }) {
  return error.flatten().fieldErrors;
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function loginAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", fields: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      status: "error",
      message: "Não foi possível entrar. Revise e-mail, senha e confirmação do e-mail.",
    };
  }

  redirect(safeNextPath(parsed.data.next));
}

export async function registerAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", fields: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent(
        safeNextPath(parsed.data.next, "/aguardando-aprovacao"),
      )}`,
    },
  });

  if (error) {
    return {
      status: "error",
      message: "Não foi possível criar a conta. Tente novamente em alguns instantes.",
    };
  }

  if (data.session) {
    redirect(safeNextPath(parsed.data.next, "/aguardando-aprovacao"));
  }

  return {
    status: "success",
    message: "Conta criada. Confirme o e-mail para continuar.",
  };
}

export async function forgotPasswordAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { status: "error", fields: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl()}/auth/callback?next=/redefinir-senha`,
  });

  return {
    status: "success",
    message: "Se o e-mail estiver cadastrado, você receberá o link de recuperação.",
  };
}

export async function resetPasswordAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { status: "error", fields: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    return {
      status: "error",
      message: "O link expirou. Solicite uma nova recuperação de senha.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      status: "error",
      message: "Não foi possível redefinir a senha. Solicite um novo link.",
    };
  }

  await supabase.auth.signOut();
  redirect("/login?message=senha-atualizada");
}

export async function signOutAction() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) {
    await supabase.auth.signOut();
  }
  redirect("/login");
}
