import { Building2, Clock3, KeyRound, ShieldCheck, UserRoundPlus } from "lucide-react";
import { redirect } from "next/navigation";

import { signOutAction } from "@/app/(auth)/actions";
import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  bootstrapOrganizationAction,
  cancelAccessRequestAction,
  lookupOrganizationAction,
  resubmitAccessRequestAction,
  submitMembershipRequestAction,
  submitOrganizationRequestAction,
} from "./actions";
import styles from "./onboarding.module.css";

const statusLabels: Record<string, string> = {
  pending: "Aguardando análise",
  correction_requested: "Correção solicitada",
  approved: "Aprovada — conclua a configuração",
  rejected: "Recusada",
  cancelled: "Cancelada",
  revoked: "Autorização revogada",
  expired: "Autorização expirada",
  closed: "Encerrada",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string; codigo?: string }>;
}) {
  const viewer = await requireViewer();
  const feedback = await searchParams;
  if (viewer.platformRole) redirect("/platform");
  if (viewer.membership?.status === "active") redirect("/app");
  if (viewer.membership) redirect("/aguardando-aprovacao");

  const supabase = await createClient();
  const { data: requests } = await supabase.from("access_requests").select("*")
    .eq("requester_user_id", viewer.userId).order("created_at", { ascending: false }).limit(5);
  const current = requests?.find((item) => ["pending", "correction_requested", "approved"].includes(item.status)) ?? null;
  const latest = requests?.[0] ?? null;
  const code = feedback.codigo?.toUpperCase();
  const { data: organizationMatches } = code
    ? await supabase.rpc("lookup_organization_join_code", { p_code: code })
    : { data: null };
  const organizationMatch = organizationMatches?.[0] ?? null;
  const defaultWhatsapp = current?.whatsapp_e164 ?? viewer.profile?.whatsapp_e164 ?? "+55";

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.brand}><span>P</span> Pedro</div>
        <header><Building2 aria-hidden="true" /><div><p>Entrada controlada</p><h1>Como você vai usar o Gril?</h1></div></header>
        <p className={styles.lead}>Sua conta está confirmada, mas nenhum dado de imobiliária é liberado sem convite individual ou aprovação explícita.</p>
        {feedback.erro ? <p className={styles.error} role="alert">{feedback.erro}</p> : null}
        {feedback.sucesso ? <p className={styles.success} role="status">{feedback.sucesso}</p> : null}

        {current ? (
          <section className={styles.requestStatus}>
            <div className={styles.statusHeading}><Clock3 aria-hidden="true" /><div><small>Solicitação atual</small><strong>{statusLabels[current.status] ?? current.status}</strong></div></div>
            <dl>
              <div><dt>Tipo</dt><dd>{current.request_type === "create_organization" ? "Nova imobiliária" : current.requested_role === "manager" ? "Gestor" : "Corretor"}</dd></div>
              <div><dt>Enviada</dt><dd>{new Date(current.last_submitted_at).toLocaleString("pt-BR")}</dd></div>
              <div><dt>Versão</dt><dd>{current.version}</dd></div>
            </dl>
            {current.public_reason ? <p className={styles.reason}>{current.public_reason}</p> : null}

            {current.status === "correction_requested" ? (
              <form action={resubmitAccessRequestAction} className={styles.formCard}>
                <input name="requestId" type="hidden" value={current.id} />
                <label><span>WhatsApp</span><input defaultValue={current.whatsapp_e164} name="whatsapp" required /></label>
                {current.request_type === "create_organization" ? <>
                  <label><span>Nome pretendido</span><input defaultValue={current.organization_name ?? ""} name="organizationName" required /></label>
                  <div className={styles.row}><label><span>Cidade</span><input defaultValue={current.city ?? ""} name="city" required /></label><label><span>UF</span><input defaultValue={current.state ?? ""} maxLength={2} name="state" required /></label></div>
                  <div className={styles.row}><label><span>CNPJ (opcional)</span><input defaultValue={current.cnpj ?? ""} name="cnpj" /></label><label><span>CRECI (opcional)</span><input defaultValue={current.creci ?? ""} name="creci" /></label></div>
                  <label><span>Quantidade aproximada de corretores (opcional)</span><input defaultValue={current.approximate_brokers ?? ""} min={0} name="approximateBrokers" type="number" /></label>
                  <label><span>Breve descrição (opcional)</span><textarea defaultValue={current.operation_description ?? ""} name="operationDescription" rows={3} /></label>
                </> : <label><span>Mensagem de apresentação (opcional)</span><textarea defaultValue={current.introduction ?? ""} name="introduction" rows={3} /></label>}
                <button type="submit">Reenviar correções</button>
              </form>
            ) : null}

            {current.status === "approved" && current.request_type === "create_organization" ? (
              <form action={bootstrapOrganizationAction} className={styles.formCard}>
                <input name="accessRequestId" type="hidden" value={current.id} />
                <p className={styles.approved}><ShieldCheck aria-hidden="true" /> A aprovação libera somente este onboarding e expira em {current.approval_expires_at ? new Date(current.approval_expires_at).toLocaleDateString("pt-BR") : "30 dias"}.</p>
                <label><span>Nome final da imobiliária</span><input defaultValue={current.organization_name ?? ""} name="organizationName" required /></label>
                <label><span>Nome da operação</span><input defaultValue="Operação principal" name="operationName" required /></label>
                <div className={styles.row}><label><span>Cidade</span><input defaultValue={current.city ?? ""} name="city" required /></label><label><span>UF</span><input defaultValue={current.state ?? ""} maxLength={2} name="state" required /></label></div>
                <label><span>Fuso horário</span><select defaultValue="America/Sao_Paulo" name="timezone"><option value="America/Sao_Paulo">Brasília</option><option value="America/Manaus">Manaus</option><option value="America/Cuiaba">Cuiabá</option><option value="America/Rio_Branco">Rio Branco</option></select></label>
                <button type="submit">Criar organização aprovada</button>
              </form>
            ) : null}

            <form action={cancelAccessRequestAction}><input name="requestId" type="hidden" value={current.id} /><button className={styles.signOut} type="submit">Cancelar solicitação</button></form>
          </section>
        ) : (
          <div className={styles.choiceGrid}>
            <section className={styles.choice}>
              <div className={styles.choiceTitle}><UserRoundPlus aria-hidden="true" /><div><small>Caminho 1</small><h2>Criar nova imobiliária</h2></div></div>
              <p>Você solicita uma operação nova. A plataforma revisa e, quando aprovada, você conclui o onboarding como dono.</p>
              <form action={submitOrganizationRequestAction} className={styles.formCard}>
                <label><span>WhatsApp</span><input defaultValue={defaultWhatsapp} name="whatsapp" placeholder="+5511999999999" required /></label>
                <label><span>Nome pretendido da imobiliária</span><input name="organizationName" required /></label>
                <div className={styles.row}><label><span>Cidade</span><input name="city" required /></label><label><span>UF</span><input maxLength={2} name="state" required /></label></div>
                <div className={styles.row}><label><span>CNPJ (opcional)</span><input name="cnpj" /></label><label><span>CRECI (opcional)</span><input name="creci" /></label></div>
                <label><span>Quantidade aproximada de corretores (opcional)</span><input min={0} name="approximateBrokers" type="number" /></label>
                <label><span>Breve descrição da operação (opcional)</span><textarea name="operationDescription" rows={3} /></label>
                <button type="submit">Enviar para aprovação</button>
              </form>
            </section>

            <section className={styles.choice}>
              <div className={styles.choiceTitle}><KeyRound aria-hidden="true" /><div><small>Caminhos 2 e 3</small><h2>Entrar em uma imobiliária</h2></div></div>
              <p>Use o código de 8 caracteres. Ele só localiza a imobiliária; o acesso depende da aprovação do dono ou gestor autorizado.</p>
              {!organizationMatch ? <form action={lookupOrganizationAction} className={styles.codeForm}><label><span>Código da imobiliária</span><input autoCapitalize="characters" maxLength={8} name="joinCode" pattern="[A-HJ-NP-Z2-9]{8}" required /></label><button type="submit">Localizar</button></form> : (
                <form action={submitMembershipRequestAction} className={styles.formCard}>
                  <input name="joinCode" type="hidden" value={code} />
                  <div className={styles.organizationMatch}><Building2 aria-hidden="true" /><span><small>Imobiliária localizada</small><strong>{organizationMatch.organization_name}</strong><em>{[organizationMatch.city, organizationMatch.state].filter(Boolean).join(" / ") || "Localidade não informada"}</em></span></div>
                  <label className={styles.checkbox}><input name="confirmOrganization" type="checkbox" value="yes" required /><span>Confirmo que esta é a imobiliária correta.</span></label>
                  <label><span>Quero entrar como</span><select name="role"><option value="broker">Corretor</option><option value="manager">Gestor</option></select></label>
                  <label><span>WhatsApp</span><input defaultValue={defaultWhatsapp} name="whatsapp" required /></label>
                  <label><span>Mensagem de apresentação (opcional)</span><textarea name="introduction" rows={3} /></label>
                  <button type="submit">Solicitar acesso</button>
                </form>
              )}
            </section>
          </div>
        )}

        {!current && latest ? <p className={styles.history}>Última solicitação: {statusLabels[latest.status] ?? latest.status}{latest.public_reason ? ` — ${latest.public_reason}` : ""}</p> : null}
        <p className={styles.safety}><ShieldCheck size={16} /> E-mail confirmado, uma solicitação aberta por vez e histórico permanente de decisões.</p>
        <form action={signOutAction}><button className={styles.signOut} type="submit">Sair e usar outra conta</button></form>
      </section>
    </main>
  );
}
