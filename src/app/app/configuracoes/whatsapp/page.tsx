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
import { metaWebhookVerifyToken } from "@/lib/integrations/whatsapp-runtime";
import { createClient } from "@/lib/supabase/server";
import {
  changeConnectionStateAction,
  configureMetaTemplateAction,
  configureUazapiWebhookAction,
  connectMetaAction,
  connectUazapiAction,
  syncMetaTemplatesAction,
} from "./actions";
import styles from "../../inbox/inbox.module.css";
import { UazapiPairingForm } from "./uazapi-pairing-form";
import { UazapiInstanceForm } from "./uazapi-instance-form";

export default async function WhatsappSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const viewer = await requireActiveViewer();
  const feedback = await searchParams;
  const supabase = await createClient();
  const [{ data: connections }, { data: accounts }, { data: templates }] =
    await Promise.all([
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
      supabase
        .from("whatsapp_message_templates")
        .select("*")
        .eq("org_id", viewer.organization!.id)
        .order("external_name"),
    ]);
  const accountById = new Map(
    accounts?.map((account) => [account.id, account]),
  );
  const isOwner = viewer.membership?.role === "owner";
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Autosserviço seguro</p>
          <h1>Contas de WhatsApp</h1>
          <p>
            Cada organização conecta suas próprias contas Uazapi ou Meta
            oficial.
          </p>
        </div>
      </header>
      {feedback.erro ? (
        <p className={styles.errorBanner}>{feedback.erro}</p>
      ) : null}
      {feedback.sucesso ? (
        <p className={styles.successBanner}>{feedback.sucesso}</p>
      ) : null}

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
                    {connection.provider === "meta_cloud"
                      ? "Meta oficial"
                      : "Uazapi"}{" "}
                    · {connection.phone_e164 || "número pendente"}
                  </small>
                  <small>
                    Credencial{" "}
                    {account?.credential_hint ?? "legada/não vinculada"} ·{" "}
                    {account?.status ?? "pendente"}
                  </small>
                  {isOwner && account ? (
                    <small>
                      Callback:{" "}
                      <code>
                        {appUrl}/api/webhooks/whatsapp/{connection.id}
                      </code>
                    </small>
                  ) : null}
                  {isOwner &&
                  account &&
                  connection.provider === "meta_cloud" ? (
                    <small>
                      Token de verificação:{" "}
                      <code>{metaWebhookVerifyToken(connection.id)}</code>
                    </small>
                  ) : null}
                </span>
                <span className={styles.contextBadge}>{connection.status}</span>
                {isOwner && account ? (
                  <div className={styles.connectionActions}>
                    <form action={retestIntegrationAction}>
                      <input
                        name="integrationAccountId"
                        type="hidden"
                        value={account.id}
                      />
                      <input
                        name="returnTo"
                        type="hidden"
                        value="/app/configuracoes/whatsapp"
                      />
                      <button className={styles.actionButton} type="submit">
                        <RefreshCw size={13} /> Testar
                      </button>
                    </form>
                    <form action={revokeIntegrationAction}>
                      <input
                        name="integrationAccountId"
                        type="hidden"
                        value={account.id}
                      />
                      <input
                        name="returnTo"
                        type="hidden"
                        value="/app/configuracoes/whatsapp"
                      />
                      <button className={styles.dangerButton} type="submit">
                        <Trash2 size={13} /> Revogar
                      </button>
                    </form>
                    <form
                      action={changeConnectionStateAction}
                      className={styles.activationForm}
                    >
                      <input
                        name="connectionId"
                        type="hidden"
                        value={connection.id}
                      />
                      <input
                        name="action"
                        type="hidden"
                        value={
                          connection.status === "active" ? "pause" : "activate"
                        }
                      />
                      {connection.status !== "active" ? (
                        <>
                          <label>
                            <input
                              defaultChecked
                              name="inboundEnabled"
                              type="checkbox"
                            />{" "}
                            inbound
                          </label>
                          <label>
                            <input name="campaignEnabled" type="checkbox" />{" "}
                            campanhas
                          </label>
                        </>
                      ) : null}
                      <button className={styles.actionButton} type="submit">
                        {connection.status === "active" ? "Pausar" : "Ativar"}
                      </button>
                    </form>
                    {connection.provider === "meta_cloud" ? (
                      <form action={syncMetaTemplatesAction}>
                        <input
                          name="connectionId"
                          type="hidden"
                          value={connection.id}
                        />
                        <button className={styles.actionButton} type="submit">
                          <RefreshCw size={13} /> Sincronizar templates
                        </button>
                      </form>
                    ) : null}
                    {connection.provider === "uazapi" ? (
                      <form action={configureUazapiWebhookAction}>
                        <input
                          name="connectionId"
                          type="hidden"
                          value={connection.id}
                        />
                        <button className={styles.actionButton} type="submit">
                          <RefreshCw size={13} /> Configurar webhook
                        </button>
                      </form>
                    ) : null}
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
          {templates?.length ? (
            <section className={styles.connectionList}>
              <h2>Templates Meta</h2>
              {templates.map((template) => (
                <article className={styles.connectionCard} key={template.id}>
                  <span>
                    <strong>{template.external_name}</strong>
                    <small>
                      {template.language} ·{" "}
                      {template.category ?? "sem categoria"} ·{" "}
                      {template.provider_status} · {template.variable_count}{" "}
                      variável(is)
                    </small>
                    <small>
                      {template.enabled
                        ? `Ativo para ${template.purpose}`
                        : "Não habilitado para automação"}
                    </small>
                  </span>
                  {isOwner &&
                  template.provider_status === "APPROVED" &&
                  template.variable_count <= 1 ? (
                    <form
                      action={configureMetaTemplateAction}
                      className={styles.activationForm}
                    >
                      <input
                        name="templateId"
                        type="hidden"
                        value={template.id}
                      />
                      <select
                        defaultValue={template.purpose ?? "campaign"}
                        name="purpose"
                      >
                        <option value="campaign">Campanha</option>
                        <option value="followup">Follow-up</option>
                        <option value="call_reminder">Lembrete de call</option>
                        <option value="operational">Aviso à equipe</option>
                        <option value="general">Geral fora de 24h</option>
                      </select>
                      <select
                        defaultValue={
                          template.variable_count === 0
                            ? "none"
                            : template.parameter_strategy === "none"
                              ? "first_name"
                              : template.parameter_strategy
                        }
                        name="strategy"
                        disabled={template.variable_count === 0}
                      >
                        <option value="none">Sem variável</option>
                        <option value="first_name">Primeiro nome</option>
                        <option value="body">Texto da mensagem</option>
                        <option value="call_datetime">Data/hora da call</option>
                        <option value="call_link">Link da videochamada</option>
                      </select>
                      <button className={styles.actionButton}>Habilitar</button>
                    </form>
                  ) : null}
                </article>
              ))}
            </section>
          ) : null}
        </section>

        <div className={styles.formStack}>
          {isOwner ? (
            <>
              <UazapiInstanceForm className={styles.connectionForm} />
              <UazapiPairingForm className={styles.connectionForm} />
              <form
                action={connectUazapiAction}
                className={styles.connectionForm}
              >
                <div>
                  <p className={styles.eyebrow}>Instância existente</p>
                  <h2>Conectar Uazapi</h2>
                </div>
                <label>
                  <span>Nome interno</span>
                  <input
                    name="name"
                    placeholder="WhatsApp atendimento"
                    required
                  />
                </label>
                <label>
                  <span>Operação</span>
                  <select name="operationId" required>
                    {viewer.operations.map((operation) => (
                      <option key={operation.id} value={operation.id}>
                        {operation.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>URL raiz da Uazapi</span>
                  <input
                    name="baseUrl"
                    placeholder="https://sua-instancia.uazapi.com"
                    type="url"
                    required
                  />
                </label>
                <label>
                  <span>Token da instância</span>
                  <input
                    autoComplete="new-password"
                    name="token"
                    spellCheck={false}
                    type="password"
                    required
                  />
                </label>
                <p className={styles.formNotice}>
                  <ShieldCheck size={15} /> O backend testa{" "}
                  <code>/instance/status</code> antes de gravar.
                </p>
                <button type="submit">
                  <KeyRound size={14} /> Validar e conectar
                </button>
              </form>

              <form
                action={connectMetaAction}
                className={styles.connectionForm}
              >
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
                      <option key={operation.id} value={operation.id}>
                        {operation.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>WABA ID</span>
                  <input inputMode="numeric" name="wabaId" required />
                </label>
                <label>
                  <span>Phone Number ID</span>
                  <input inputMode="numeric" name="phoneNumberId" required />
                </label>
                <label>
                  <span>Token permanente do System User</span>
                  <input
                    autoComplete="new-password"
                    name="accessToken"
                    spellCheck={false}
                    type="password"
                    required
                  />
                </label>
                <label>
                  <span>App Secret da Meta</span>
                  <input
                    autoComplete="new-password"
                    name="appSecret"
                    spellCheck={false}
                    type="password"
                    required
                  />
                </label>
                <p className={styles.formNotice}>
                  <ShieldCheck size={15} /> WABA, telefone, token e App Secret
                  são validados juntos na Graph API.
                </p>
                <button type="submit">
                  <KeyRound size={14} /> Validar e conectar
                </button>
              </form>
            </>
          ) : (
            <section className={styles.connectionForm}>
              <h2>Credenciais protegidas</h2>
              <p className={styles.formNotice}>
                Somente o dono da organização pode conectar, trocar ou revogar
                credenciais.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
