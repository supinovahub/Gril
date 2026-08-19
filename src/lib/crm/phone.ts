import { z } from "zod";

function canonicalizeBrazilianMobile(digits: string) {
  if (!/^55[1-9][0-9][6-9][0-9]{7}$/.test(digits)) return digits;

  return `${digits.slice(0, 4)}9${digits.slice(4)}`;
}

export function normalizePhoneToE164(value: string) {
  const input = value.trim();
  const digits = input.replace(/\D/g, "");

  if (input.startsWith("+")) {
    const canonicalDigits = canonicalizeBrazilianMobile(digits);
    return canonicalDigits.length >= 8 && canonicalDigits.length <= 15
      ? `+${canonicalDigits}`
      : null;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `+${canonicalizeBrazilianMobile(`55${digits}`)}`;
  }

  if (
    digits.startsWith("55") &&
    (digits.length === 12 || digits.length === 13)
  ) {
    return `+${canonicalizeBrazilianMobile(digits)}`;
  }

  return null;
}

export const leadSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do contato.").max(160),
  phone: z
    .string()
    .trim()
    .min(8, "Informe o WhatsApp com DDD.")
    .refine((value) => normalizePhoneToE164(value) !== null, {
      message: "Use um telefone válido com DDD ou código do país.",
    }),
  source: z.string().trim().min(2).max(80),
  operationId: z.string().uuid(),
  assignedMembershipId: z.string().uuid().optional().or(z.literal("")),
  aiContext: z.string().trim().max(4000).optional(),
  internalNote: z.string().trim().max(4000).optional(),
  shareContextWithBroker: z.boolean(),
  desiredAction: z.enum(["register", "assume", "request_pedro"]),
  authorizationConfirmed: z.boolean(),
});

