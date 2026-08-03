import { z } from "zod";

export function normalizeWhatsApp(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? `+${digits}` : null;
}

export const optionalWhatsAppSchema = z
  .string()
  .trim()
  .transform(normalizeWhatsApp)
  .refine((value) => value === null || /^\+[1-9][0-9]{7,14}$/.test(value), {
    message: "Informe país, DDD e número. Ex.: +55 11 99999-9999.",
  });

export const requiredWhatsAppSchema = optionalWhatsAppSchema.refine(
  (value): value is string => value !== null,
  { message: "O WhatsApp é obrigatório para gestores e corretores." },
);

export function isWhatsAppConflict(error: { code?: string; message?: string } | null) {
  return Boolean(
    error
      && (error.code === "23505"
        || error.message?.includes("whatsapp_already_in_use")
        || error.message?.includes("profiles_whatsapp_e164_unique_idx")),
  );
}
