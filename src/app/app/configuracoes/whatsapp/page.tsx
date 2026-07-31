import { Cable, CheckCircle2, CircleDashed, ShieldCheck } from "lucide-react";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createConnectionAction } from "./actions";
import styles from "../../inbox/inbox.module.css";

export default async function WhatsappSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const viewer = await requireActiveViewer();
  const feedback = await searchParams;
  const supabase = await createClient();
  const { data: connections } = await supabase
    .from("whatsapp_connections")
    .select("*")
    .eq("org_id", viewer.organization!.id)
    .order("created_at");

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}><div><p className={styles.eyebrow}>Conectores</p><h1>Números de WhatsApp</h1><p>Uazapi e Meta Cloud compartilham o mesmo contrato normalizado.</p></div></header>
      {feedback.erro ? <p className={styles.errorBanner}>{feedback.erro}</p> : null}
      {feedback.sucesso ? <p className={styles.successBanner}>Rascunho salvo. Nenhuma mensagem será recebida ou enviada antes da ativação técnica.</p> : null}

      <div className={styles.settingsLayout}>
        <section className={styles.connectionList}>
          <h2>Conexões cadastradas</h2>
          {connections?.map((connection) => (
            <article key={connection.id}>
              <span className={styles.connectionIcon}>{connection.status === "active" ? <CheckCircle2 size={20} /> : <CircleDashed size={20} />}</span>
              <span><strong>{connection.name}</strong><small>{connection.provider} · {connection.phone_e164 || "número pendente"}</small></span>
              <span className={styles.contextBadge}>{connection.status}</span>
            </article>
          ))}
          {!connections?.length ? <div className={styles.empty}><Cable size={28} /><span>Nenhuma conexão cadastrada.</span></div> : null}
        </section>

        <form action={createConnectionAction} className={styles.connectionForm}>
          <div><p className={styles.eyebrow}>Novo rascunho</p><h2>Configurar conector</h2></div>
          <label><span>Nome interno</span><input name="name" placeholder="WhatsApp atendimento" required /></label>
          <label><span>Provedor</span><select name="provider"><option value="uazapi">Uazapi</option><option value="meta_cloud">Meta Cloud API</option></select></label>
          <label><span>Operação</span><select name="operationId">{viewer.operations.map((operation) => <option key={operation.id} value={operation.id}>{operation.name}</option>)}</select></label>
          <label><span>Número com DDD</span><input name="phone" placeholder="+55 11 99999-9999" /></label>
          <label><span>Nome visível do perfil</span><input name="visibleProfileName" /></label>
          <label><span>Endpoint do provedor</span><input name="endpointUrl" placeholder="https://..." type="url" /></label>
          <label><span>Referência do secret</span><input name="secretReference" placeholder="SUPABASE_SECRET_UAZAPI_MAIN" /></label>
          <p className={styles.formNotice}><ShieldCheck size={15} /> Tokens nunca são armazenados nesta tabela. O campo registra apenas o nome da variável secreta configurada no Supabase.</p>
          <button type="submit">Salvar rascunho</button>
        </form>
      </div>
    </div>
  );
}

