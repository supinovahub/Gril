"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isWhatsAppConflict, requiredWhatsAppSchema } from "@/lib/whatsapp";

export type RequiredWhatsappState = {
  status: "idle" | "error";
  message?: string;
  fields?: Record<string, string[]>;
};

const schema = z.object({ whatsapp: requiredWhatsAppSchema });

export async function saveRequiredWhatsappAction(
  _previous: RequiredWhatsappState,
  formData: FormData,
): Promise<RequiredWhatsappState> {
  const parsed = schema.safeParse({ whatsapp: formData.get("whatsapp") });
  if (!parsed.success) {
    return { status: "error", fields: parsed.error.flatten().fieldErrors };
  }

  const viewer = await requireViewer();
  if (
    viewer.membership?.status !== "active"
    || !["manager", "broker"].includes(viewer.membership.role)
  ) {
    redirect("/app");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ whatsapp_e164: parsed.data.whatsapp })
    .eq("user_id", viewer.userId);

  if (error) {
    return {
      status: "error",
      message: isWhatsAppConflict(error)
        ? "Este número já está em uso. Informe outro WhatsApp ou fale com o suporte."
        : "Não foi possível salvar o WhatsApp. Tente novamente.",
    };
  }

  redirect("/app");
}
