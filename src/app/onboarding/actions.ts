"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const bootstrapSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  operationName: z.string().trim().min(2).max(120),
  timezone: z.enum(["America/Sao_Paulo", "America/Manaus", "America/Cuiaba", "America/Rio_Branco"]),
});

export async function bootstrapOrganizationAction(formData: FormData) {
  const parsed = bootstrapSchema.safeParse({
    organizationName: formData.get("organizationName"),
    operationName: formData.get("operationName"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) {
    redirect(`/onboarding?erro=${encodeURIComponent("Revise os nomes e o fuso da operação.")}`);
  }

  const viewer = await requireViewer();
  if (viewer.membership?.status === "active") redirect("/app");
  if (viewer.membership) redirect("/aguardando-aprovacao");

  const supabase = await createClient();
  const { error } = await supabase.from("organization_bootstrap_requests").insert({
    actor_user_id: viewer.userId,
    operation_name: parsed.data.operationName,
    organization_name: parsed.data.organizationName,
    timezone: parsed.data.timezone,
  });
  if (error) {
    const message = error.message.includes("membership_exists")
      ? "Esta conta já pertence a uma organização. Entre novamente."
      : "Não foi possível criar a operação. Revise os dados e tente novamente.";
    redirect(`/onboarding?erro=${encodeURIComponent(message)}`);
  }

  revalidatePath("/app", "layout");
  redirect("/app/configuracoes/organizacao?sucesso=operacao-criada");
}
