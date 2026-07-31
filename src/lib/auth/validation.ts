import { z } from "zod";

const password = z
  .string()
  .min(10, "Use pelo menos 10 caracteres.")
  .regex(/[A-Za-z]/, "Inclua ao menos uma letra.")
  .regex(/[0-9]/, "Inclua ao menos um número.");

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe sua senha."),
  next: z.string().optional(),
});

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome completo.").max(120),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  password,
  next: z.string().optional(),
});

export const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
});

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas precisam ser iguais.",
    path: ["confirmPassword"],
  });

export type AuthActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fields?: Record<string, string[]>;
};

export const initialAuthState: AuthActionState = { status: "idle" };
