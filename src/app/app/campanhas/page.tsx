import { IntentPrefetchLink as Link } from "@/components/navigation/intent-prefetch-link";
import {
  Archive,
  CircleAlert,
  CircleGauge,
  ContactRound,
  Database,
  FileSpreadsheet,
  Layers3,
  Megaphone,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  ShieldCheck,
} from "lucide-react";

import { requireActiveViewer } from "@/lib/auth/session";
import { DEFAULT_CAMPAIGN_VARIANTS } from "@/lib/campaigns/message-variants";
import { belongsToCampaignView } from "@/lib/campaigns/view";
import { createClient } from "@/lib/supabase/server";
import {
  editCampaignAction,
  importCampaignAction,
  releaseWaveAction,
  transitionCampaignAction,
} from "./actions";
import { CampaignCreateForm } from "./campaign-create-form";
import styles from "./campaigns.module.css";

const statusLabels: Record<string, string> = {
  approved: "Pronta para envio",
  archived: "Arquivada",
  draft: "Rascunho",
  importing: "Processando base",
  paused: "Pausada",
  review: "Aguardando revisão",
  running: "Em andamento",
};

const automationLabels: Record<string, string> = {
  assisted: "Sugere para revisão",
  off: "Desligada",
  production: "Responde automaticamente",
  shadow: "Somente observa",
};

function importIssueText(errorCode: string | null) {
  if (errorCode === "already_in_campaign") return "Contato já incluído nesta campanha";
  return "Nome ausente, curto ou telefone inválido";
}

function waveLabel(waveCount: number) {
  if (waveCount === 0) return "onda de 20";
  if (waveCount === 1) return "onda de 50";
  return "restante";
}

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ arquivadas?: string; erro?: string; sucesso?: string }>;
}) {
  const viewer = await requireActiveViewer();
  const feedback = await searchParams;
  const supabase = await createClient();
  const showingArchived = feedback.arquivadas === "1";
  const campaignsQuery = supabase
    .from("campaigns")
    .select("*,whatsapp_connections(name,phone_e164,provider)")
    .eq("org_id", viewer.organization!.id);

  if (showingArchived) campaignsQuery.eq("status", "archived").not("archived_at", "is", null);
  else campaignsQuery.neq("status", "archived").is("archived_at", null);
  campaignsQuery.order("created_at", { ascending: false });

  const [
    { data: campaigns },
    { data: connections },
    { data: contacts },
    { data: imports },
    { data: importIssues },
    { data: waves },
    { data: templates },
  ] = await Promise.all([
    campaignsQuery,
    supabase
      .from("whatsapp_connections")
      .select("id,name,phone_e164,provider")
      .eq("org_id", viewer.organization!.id)
      .eq("status", "active")
      .eq("campaign_enabled", true),
    supabase.from("campaign_contacts").select("id,campaign_id,status,contacts(name)").eq("org_id", viewer.organization!.id),
    supabase
      .from("campaign_imports")
      .select("id,campaign_id,total_rows,valid_rows,duplicate_rows,error_rows,status,created_at,mapping,file_sha256")
      .eq("org_id", viewer.organization!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("campaign_import_rows")
      .select("import_id,row_number,status,error_code,normalized_name,normalized_phone")
      .eq("org_id", viewer.organization!.id)
      .in("status", ["error", "duplicate"])
      .order("row_number")
      .limit(100),
    supabase
      .from("campaign_waves")
      .select("id,campaign_id,wave_number,released_count,suppressed_count,status,released_at")
      .eq("org_id", viewer.organization!.id)
      .order("wave_number", { ascending: false }),
    supabase
      .from("whatsapp_message_templates")
      .select("id,connection_id,external_name,language")
      .eq("org_id", viewer.organization!.id)
      .eq("enabled", true)
      .eq("purpose", "campaign")
      .eq("provider_status", "APPROVED"),
  ]);

  const visibleCampaigns = (campaigns ?? []).filter((campaign) => belongsToCampaignView(campaign, showingArchived));
  const visibleCampaignIds = new Set(visibleCampaigns.map((campaign) => campaign.id));
  const visibleContacts = (contacts ?? []).filter((contact) => visibleCampaignIds.has(contact.campaign_id));
  const runningCampaigns = visibleCampaigns.filter((campaign) => campaign.status === "running").length;
  const campaignsInPreparation = visibleCampaigns.filter((campaign) => ["draft", "importing", "review"].includes(campaign.status)).length;
  const readyContacts = visibleContacts.filter((contact) => contact.status === "ready").length;
  const queuedContacts = visibleContacts.filter((contact) => contact.status === "queued").length;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Reativação controlada</p>
          <h1>Campanhas</h1>
          <p>Prepare a base, revise as mensagens e libere cada onda com controle.</p>
        </div>
        <div className={styles.headerTools}>
          <span className={styles.limit}><ShieldCheck aria-hidden="true" size={16} /> até 500 contatos</span>
          <nav className={styles.viewTabs} aria-label="Visualização de campanhas">
            <Link className={!showingArchived ? styles.activeTab : undefined} href="/app/campanhas" prefetch={false}>Ativas</Link>
            <Link className={showingArchived ? styles.activeTab : undefined} href="/app/campanhas?arquivadas=1" prefetch={false}>
              <Archive aria-hidden="true" size={14} /> Arquivadas
            </Link>
          </nav>
        </div>
      </header>

      {feedback.erro ? <p className={styles.error} role="alert">{feedback.erro}</p> : null}
      {feedback.sucesso ? <p className={styles.success} role="status">{feedback.sucesso}</p> : null}
      {!connections?.length ? (
        <p className={styles.warning} role="status">
          <CircleAlert aria-hidden="true" size={16} /> Ative uma conexão WhatsApp para criar a primeira campanha.
        </p>
      ) : null}

      <section className={styles.campaignSummary} aria-label="Resumo das campanhas">
        <span><CircleGauge aria-hidden="true" size={18} /><small>Em andamento</small><strong>{runningCampaigns}</strong></span>
        <span><Layers3 aria-hidden="true" size={18} /><small>Em preparação</small><strong>{campaignsInPreparation}</strong></span>
        <span><ContactRound aria-hidden="true" size={18} /><small>Prontos para envio</small><strong>{readyContacts}</strong></span>
        <span><Database aria-hidden="true" size={18} /><small>Na fila</small><strong>{queuedContacts}</strong></span>
      </section>

      {!showingArchived ? (
        <details className={styles.createCampaign} open={!campaigns?.length}>
          <summary>
            <span className={styles.summaryIcon}><Megaphone aria-hidden="true" size={17} /></span>
            <span><strong>Nova campanha</strong><small>Crie um rascunho sem iniciar nenhum envio</small></span>
            <span className={styles.summaryAction}>Começar</span>
          </summary>
          <CampaignCreateForm
            connections={connections ?? []}
            templates={templates ?? []}
            variants={DEFAULT_CAMPAIGN_VARIANTS}
          />
        </details>
      ) : null}

      <main className={styles.list}>
        <div className={styles.listHeading}>
          <div>
            <h2>{showingArchived ? "Campanhas arquivadas" : "Campanhas em operação"}</h2>
            <p>{visibleCampaigns.length} {visibleCampaigns.length === 1 ? "campanha" : "campanhas"}</p>
          </div>
          <span>A próxima ação aparece em destaque</span>
        </div>

        {visibleCampaigns.map((campaign) => {
          const campaignContacts = (contacts ?? []).filter((item) => item.campaign_id === campaign.id);
          const stats = campaignContacts.reduce<Record<string, number>>((acc, item) => {
            acc[item.status] = (acc[item.status] ?? 0) + 1;
            return acc;
          }, {});
          const latestImport = (imports ?? []).find((item) => item.campaign_id === campaign.id);
          const latestImportIssues = (importIssues ?? []).filter((item) => item.import_id === latestImport?.id);
          const campaignWaves = (waves ?? []).filter((item) => item.campaign_id === campaign.id);
          const connection = campaign.whatsapp_connections as { name: string; phone_e164: string | null; provider: string } | null;
          const openingExamples = Array.isArray(campaign.opening_examples)
            ? campaign.opening_examples.filter((item): item is string => typeof item === "string")
            : [];
          const canEdit = ["draft", "importing", "review", "approved"].includes(campaign.status) && campaignWaves.length === 0;
          const canImport = ["draft", "importing", "review"].includes(campaign.status);
          const canRelease = ["approved", "running"].includes(campaign.status) && campaignWaves.length < 3 && (stats.ready ?? 0) > 0;
          const releasedContacts = campaignWaves.reduce((total, wave) => total + (wave.released_count ?? 0), 0);

          return (
            <article className={styles.campaignRow} key={campaign.id}>
              <div className={styles.campaignIdentity}>
                <span className={styles.icon}><Megaphone aria-hidden="true" size={18} /></span>
                <span>
                  <strong>{campaign.name}</strong>
                  <small>{connection?.name ?? "Conexão indisponível"} - {connection?.phone_e164 ?? connection?.provider ?? "sem número"}</small>
                </span>
              </div>

              <div className={styles.campaignState}>
                <span className={styles.statusBadge} data-status={campaign.status}>{statusLabels[campaign.status] ?? campaign.status}</span>
                <small>Automação: {automationLabels[campaign.ai_mode] ?? campaign.ai_mode}</small>
              </div>

              <dl className={styles.rowMetrics}>
                <div><dt>Base válida</dt><dd>{latestImport?.valid_rows ?? 0}</dd></div>
                <div><dt>Prontos</dt><dd>{stats.ready ?? 0}</dd></div>
                <div><dt>Liberados</dt><dd>{releasedContacts}</dd></div>
                <div><dt>Ondas</dt><dd>{campaignWaves.length} de 3</dd></div>
              </dl>

              <div className={styles.rowAction}>
                {campaign.status === "review" ? (
                  <form action={transitionCampaignAction}>
                    <input name="campaignId" type="hidden" value={campaign.id} />
                    <input name="expectedVersion" type="hidden" value={campaign.version} />
                    <input name="action" type="hidden" value="approve" />
                    <button className={styles.primaryButton}>Aprovar campanha</button>
                  </form>
                ) : null}
                {canRelease ? (
                  <form action={releaseWaveAction}>
                    <input name="campaignId" type="hidden" value={campaign.id} />
                    <input name="count" type="hidden" value={campaignWaves.length === 0 ? 20 : campaignWaves.length === 1 ? 50 : 500} />
                    <button className={styles.primaryButton}><Play aria-hidden="true" size={14} /> Liberar {waveLabel(campaignWaves.length)}</button>
                  </form>
                ) : null}
                {campaign.status === "paused" ? (
                  <form action={transitionCampaignAction}>
                    <input name="campaignId" type="hidden" value={campaign.id} />
                    <input name="expectedVersion" type="hidden" value={campaign.version} />
                    <input name="action" type="hidden" value="resume" />
                    <button className={styles.primaryButton}><Play aria-hidden="true" size={14} /> Retomar</button>
                  </form>
                ) : null}
                {["approved", "running"].includes(campaign.status) && !canRelease && campaignWaves.length < 3 ? (
                  <span className={styles.blockedAction}>Aguardando contatos prontos</span>
                ) : null}
                <details className={styles.moreMenu}>
                  <summary aria-label={`Mais ações para ${campaign.name}`}><MoreHorizontal aria-hidden="true" size={18} /></summary>
                  <div>
                    {campaign.status === "running" ? (
                      <form action={transitionCampaignAction}>
                        <input name="campaignId" type="hidden" value={campaign.id} />
                        <input name="expectedVersion" type="hidden" value={campaign.version} />
                        <input name="action" type="hidden" value="pause" />
                        <button><Pause aria-hidden="true" size={14} /> Pausar</button>
                      </form>
                    ) : null}
                    {campaign.status !== "archived" ? (
                      <form action={transitionCampaignAction}>
                        <input name="campaignId" type="hidden" value={campaign.id} />
                        <input name="expectedVersion" type="hidden" value={campaign.version} />
                        <input name="action" type="hidden" value="archive" />
                        <button><Archive aria-hidden="true" size={14} /> Arquivar</button>
                      </form>
                    ) : null}
                  </div>
                </details>
              </div>

              <div className={styles.rowDetails}>
                {canImport ? (
                  <details>
                    <summary><FileSpreadsheet aria-hidden="true" size={15} /> Importar ou revisar base</summary>
                    <form action={importCampaignAction} className={styles.importForm}>
                      <input name="campaignId" type="hidden" value={campaign.id} />
                      <label>
                        <span>Arquivo CSV</span>
                        <input accept=".csv,text/csv" name="csvFile" type="file" />
                        <small>O telefone pode estar com máscara e DDD; adicionamos +55 automaticamente.</small>
                      </label>
                      <label>
                        <span>Ou cole o CSV</span>
                        <textarea name="csvText" placeholder={"cliente,celular\nMaria,(11) 99999-9999"} rows={3} />
                      </label>
                      <label><span>Coluna de nome (opcional)</span><input name="nameColumn" placeholder="Ex.: Nome" /></label>
                      <label><span>Coluna de telefone (opcional)</span><input name="phoneColumn" placeholder="Ex.: Telefone principal" /></label>
                      <button className={styles.primaryButton}><FileSpreadsheet aria-hidden="true" size={15} /> Processar base</button>
                    </form>
                  </details>
                ) : null}

                {canEdit ? (
                  <details>
                    <summary><Pencil aria-hidden="true" size={15} /> Editar configuração</summary>
                    <form action={editCampaignAction} className={styles.editForm}>
                      <input name="campaignId" type="hidden" value={campaign.id} />
                      <input name="expectedVersion" type="hidden" value={campaign.version} />
                      <label><span>Nome</span><input defaultValue={campaign.name} name="name" required /></label>
                      <label>
                        <span>Conexão ativa</span>
                        <select defaultValue={campaign.connection_id} name="connectionId" required>
                          {(connections ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} - {item.phone_e164 ?? item.provider}</option>)}
                        </select>
                      </label>
                      <label>
                        <span>Template Meta aprovado</span>
                        <select defaultValue={campaign.message_template_id ?? ""} name="messageTemplateId">
                          <option value="">Não se aplica (Uazapi)</option>
                          {(templates ?? []).map((template) => <option key={template.id} value={template.id}>{template.external_name} - {template.language}</option>)}
                        </select>
                      </label>
                      <label>
                        <span>Automação da campanha</span>
                        <select defaultValue={campaign.ai_mode} name="aiMode">
                          <option value="off">Desligada</option>
                          <option value="shadow">Somente observar</option>
                          <option value="assisted">Sugerir para revisão</option>
                          <option value="production">Responder automaticamente</option>
                        </select>
                      </label>
                      <label className={styles.fullField}><span>Abertura</span><textarea defaultValue={campaign.opening_template} name="openingTemplate" required rows={3} /></label>
                      <button className={styles.primaryButton} type="submit"><Pencil aria-hidden="true" size={14} /> Salvar alterações</button>
                    </form>
                  </details>
                ) : null}

                {openingExamples.length ? (
                  <details>
                    <summary>Revisar exemplos de abertura</summary>
                    <div className={styles.exampleList}>{openingExamples.map((example, index) => <p key={`${campaign.id}-${index}`}>{example}</p>)}</div>
                  </details>
                ) : null}

                {latestImport ? (
                  <span className={styles.importSummary}>
                    Última base: {latestImport.valid_rows} válidos, {latestImport.duplicate_rows} duplicados e {latestImport.error_rows} erros
                  </span>
                ) : null}
              </div>

              {latestImportIssues.length ? (
                <details className={styles.importIssues}>
                  <summary>Ver linhas com erro ou duplicidade</summary>
                  <ul>
                    {latestImportIssues.slice(0, 10).map((item) => (
                      <li key={`${item.import_id}-${item.row_number}`}>
                        <strong>Linha {item.row_number + 1}:</strong> {importIssueText(item.error_code)}{item.normalized_phone ? ` (${item.normalized_phone})` : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </article>
          );
        })}

        {!visibleCampaigns.length ? (
          <section className={styles.empty}>
            <Megaphone aria-hidden="true" size={25} />
            <h2>Nenhuma campanha</h2>
            <p>{showingArchived ? "Nenhuma campanha arquivada." : "Crie um rascunho para preparar a primeira reativação."}</p>
          </section>
        ) : null}
      </main>
    </div>
  );
}
