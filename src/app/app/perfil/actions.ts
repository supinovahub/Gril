"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isWhatsAppConflict, optionalWhatsAppSchema } from "@/lib/whatsapp";

export type ProfileState = {
  status: "idle" | "error" | "success";
  message?: string;
  fields?: Record<string, string[]>;
};

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome completo.").max(120),
  whatsapp: optionalWhatsAppSchema,
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
    return { status: "error", fields: parsed.error.flatten().fieldErrors };
  }

  const viewer = await requireViewer();
  if (
    viewer.membership?.status === "active"
    && ["manager", "broker"].includes(viewer.membership.role)
    && !parsed.data.whatsapp
  ) {
    return {
      status: "error",
      fields: { whatsapp: ["Gestores e corretores não podem remover o WhatsApp operacional."] },
    };
  }

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
      message: isWhatsAppConflict(error)
        ? "Este número já está em uso. Informe outro WhatsApp ou fale com o suporte."
        : "Não foi possível salvar o perfil.",
    };
  }

  revalidatePath("/app/perfil");
  return { status: "success", message: "Perfil atualizado." };
}
