"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { canManageCrm, requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const updateContactNameSchema = z.object({
  contactId: z.string().uuid(),
  name: z.string().trim().min(2, "Informe ao menos 2 caracteres.").max(160, "O nome deve ter no máximo 160 caracteres."),
  context: z.enum(["inbox", "lead"]),
  contextId: z.string().uuid(),
});

function redirectWithError(context: "inbox" | "lead", contextId: string, message: string): never {
  const path = context === "inbox" ? `/app/inbox/${contextId}` : `/app/leads/${contextId}`;
  redirect(`${path}?erro=${encodeURIComponent(message)}`);
}

export async function updateContactNameAction(formData: FormData) {
  const parsed = updateContactNameSchema.safeParse({
    contactId: formData.get("contactId"),
    name: formData.get("name"),
    context: formData.get("context"),
    contextId: formData.get("contextId"),
  });

  if (!parsed.success) {
    const context = formData.get("context") === "lead" ? "lead" : "inbox";
    const contextId = z.string().uuid().safeParse(formData.get("contextId"));
    if (contextId.success) redirectWithError(context, contextId.data, parsed.error.issues[0]?.message ?? "Revise o nome informado.");
    return;
  }

  const viewer = await requireActiveViewer();
  if (!canManageCrm(viewer)) {
    redirectWithError(parsed.data.context, parsed.data.contextId, "Você não tem permissão para editar contatos.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("contact_name_update_requests").insert({
    org_id: viewer.organization!.id,
    contact_id: parsed.data.contactId,
    name: parsed.data.name,
    actor_user_id: viewer.userId,
  });

  if (error) {
    const message = error.message.includes("contact_name_update_forbidden")
      ? "Você não tem permissão para editar contatos."
      : error.message.includes("contact_name_update_invalid_contact")
        ? "Esse contato não está disponível para edição."
        : "Não foi possível atualizar o nome do contato.";
    redirectWithError(parsed.data.context, parsed.data.contextId, message);
  }

  revalidatePath("/app/inbox");
  revalidatePath(`/app/inbox/${parsed.data.contextId}`);
  revalidatePath("/app/leads");
  revalidatePath(`/app/leads/${parsed.data.contextId}`);
  const path = parsed.data.context === "inbox" ? `/app/inbox/${parsed.data.contextId}` : `/app/leads/${parsed.data.contextId}`;
  redirect(`${path}?sucesso=nome-atualizado`);
}
