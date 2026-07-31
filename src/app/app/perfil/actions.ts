"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type ProfileState = {
  status: "idle" | "error" | "success";
  message?: string;
  fields?: Record<string, string[]>;
};

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome completo.").max(120),
  whatsapp: z
    .string()
    .trim()
    .transform((value) => {
      const digits = value.replace(/\D/g, "");
      return digits ? `+${digits}` : null;
    })
    .refine((value) => value === null || /^\+[1-9][0-9]{7,14}$/.test(value), {
      message: "Informe país, DDD e número. Ex.: +55 11 99999-9999.",
    }),
});

export async function updateProfileAction(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    whatsapp: formData.get("whatsapp"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      fields: parsed.error.flatten().fieldErrors,
    };
  }

  const viewer = await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      whatsapp_e164: parsed.data.whatsapp,
    })
    .eq("user_id", viewer.userId);

  if (error) {
    return {
      status: "error",
      message: "Não foi possível salvar o perfil.",
    };
  }

  revalidatePath("/app/perfil");
  return { status: "success", message: "Perfil atualizado." };
}
