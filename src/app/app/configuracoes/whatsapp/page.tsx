import {
  Cable,
  CheckCircle2,
  CircleDashed,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import {
  retestIntegrationAction,
  revokeIntegrationAction,
} from "@/app/app/integration-actions";
import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  changeConnectionStateAction,
  connectMetaAction,
  connectUazapiAction,
} from "./actions";
import styles from "../../inbox/inbox.module.css";

export default async function WhatsappSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const viewer = await requireActiveViewer();
  const feedback = await searchParams;
  const supabase = await createClient();
  const [{ data: connections }, { data: accounts }] = await Promise.all([
    supabase
      .from("whatsapp_connections")
      .select("*")
      .eq("org_id", viewer.organization!.id)
      .order("created_at"),
    supabase
      .from("integration_accounts")
      .select("*")
      .eq("org_id", viewer.organization!.id)
      .in("provider", ["uazapi", "meta_cloud"])
      .order("created_at"),
  ]);
  const accountById = new Map(accounts?.map((account) => [account.id, account]));
  const isOwner = viewer.membership?.role === "owner";

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Autosserviço seguro</p>
          <h1>Contas de WhatsApp</h1>
          <p>Cada organização conecta suas próprias contas Uazapi ou Meta oficial.</p>
        </div>
      </header>
      {feedback.erro ? <p className={styles.errorBanner}>{feedback.erro}</p> : null}
      {feedback.sucesso ? <p className={styles.successBanner}>{feedback.sucesso}</p> : null}

      <div className={styles.settingsLayout}>
        <section className={styles.connectionList}>
          <h2>Conexões cadastradas</h2>
          {connections?.map((connection) => {
            const account = connection.integration_account_id
              ? accountById.get(connection.integration_account_id)
              : null;
            return (
              <article className={styles.connectionCard} key={connection.id}>
                <span className={styles.connectionIcon}>
                  {account?.status === "verified" ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    <CircleDashed size={20} />
                  )}
                </span>
                <span>
                  <strong>{connection.name}</strong>
                  <small>
                    {connection.provider === "meta_cloud" ? "Meta oficial" : "Uazapi"} ·{" "}
                    {connection.phone_e164 || "número pendente"}
                  </small>
                  <small>
                    Credencial {account?.credential_hint ?? "legada/não vinculada"} ·{" "}
                    {account?.status ?? "pendente"}
                  </small>
                </span>
                <span className={styles.contextBadge}>{connection.status}</span>
                {isOwner && account ? (
                  <div className={styles.connectionActions}>
                    <form action={retestIntegrationAction}>
                      <input name="integrationAccountId" type="hidden" value={account.id} />
                      <input name="returnTo" type="hidden" value="/app/configuracoes/whatsapp" />
                      <button className={styles.actionButton} type="submit">
                        <RefreshCw size={13} /> Testar
                      </button>
                    </form>
                    <form action={revokeIntegrationAction}>
                      <input name="integrationAccountId" type="hidden" value={account.id} />
                      <input name="returnTo" type="hidden" value="/app/configuracoes/whatsapp" />
                      <button className={styles.dangerButton} type="submit">
                        <Trash2 size={13} /> Revogar
                      </button>
                    </form>
                    <form action={changeConnectionStateAction} className={styles.activationForm}>
                      <input name="connectionId" type="hidden" value={connection.id} />
                      <input
                        name="action"
                        type="hidden"
                        value={connection.status === "active" ? "pause" : "activate"}
                      />
                      {connection.status !== "active" ? (
                        <>
                          <label>
                            <input name="inboundEnabled" type="checkbox" /> inbound
                          </label>
                          <label>
                            <input name="campaignEnabled" type="checkbox" /> campanhas
                          </label>
                        </>
                      ) : null}
                      <button className={styles.actionButton} type="submit">
                        {connection.status === "active" ? "Pausar" : "Ativar"}
                      </button>
                    </form>
                  </div>
                ) : null}
              </article>
            );
          })}
          {!connections?.length ? (
            <div className={styles.empty}>
              <Cable size={28} />
              <span>Nenhuma conta de WhatsApp conectada.</span>
            </div>
          ) : null}
        </section>

        <div className={styles.formStack}>
          {isOwner ? (
            <>
              <form action={connectUazapiAction} className={styles.connectionForm}>
                <div>
                  <p className={styles.eyebrow}>Instância existente</p>
                  <h2>Conectar Uazapi</h2>
                </div>
                <label>
                  <span>Nome interno</span>
                  <input name="name" placeholder="WhatsApp atendimento" required />
                </label>
                <label>
                  <span>Operação</span>
                  <select name="operationId" required>
                    {viewer.operations.map((operation) => (
                      <option key={operation.id} value={operation.id}>{operation.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>URL raiz da Uazapi</span>
                  <input name="baseUrl" placeholder="https://sua-instancia.uazapi.com" type="url" required />
                </label>
                <label>
                  <span>Token da instância</span>
                  <input autoComplete="new-password" name="token" spellCheck={false} type="password" required />
                </label>
                <p className={styles.formNotice}>
                  <ShieldCheck size={15} /> O backend testa <code>/instance/status</code> antes de gravar.
                </p>
                <button type="submit"><KeyRound size={14} /> Validar e conectar</button>
              </form>

              <form action={connectMetaAction} className={styles.connectionForm}>
                <div>
                  <p className={styles.eyebrow}>Cloud API direta</p>
                  <h2>Conectar Meta oficial</h2>
                </div>
                <label>
                  <span>Nome interno</span>
                  <input name="name" placeholder="WhatsApp oficial" required />
                </label>
                <label>
                  <span>Operação</span>
                  <select name="operationId" required>
                    {viewer.operations.map((operation) => (
                      <option key={operation.id} value={operation.id}>{operation.name}</option>
                    ))}
                  </select>
                </label>
                <label><span>WABA ID</span><input inputMode="numeric" name="wabaId" required /></label>
                <label><span>Phone Number ID</span><input inputMode="numeric" name="phoneNumberId" required /></label>
                <label>
                  <span>Token permanente do System User</span>
                  <input autoComplete="new-password" name="accessToken" spellCheck={false} type="password" required />
                </label>
                <label>
                  <span>App Secret da Meta</span>
                  <input autoComplete="new-password" name="appSecret" spellCheck={false} type="password" required />
                </label>
                <p className={styles.formNotice}>
                  <ShieldCheck size={15} /> WABA, telefone, token e App Secret são validados juntos na Graph API.
                </p>
                <button type="submit"><KeyRound size={14} /> Validar e conectar</button>
              </form>
            </>
          ) : (
            <section className={styles.connectionForm}>
              <h2>Credenciais protegidas</h2>
              <p className={styles.formNotice}>Somente o dono da organização pode conectar, trocar ou revogar credenciais.</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
