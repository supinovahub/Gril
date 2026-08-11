import {
  ArrowLeft,
  CalendarClock,
  Check,
  CircleAlert,
  History,
  Phone,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { canManageCrm, canManageTeam, requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatOperationDateTime } from "@/lib/time/operation-format";
import { updateContactNameAction } from "../../contact-actions";
import {
  addContactPhoneAction,
  archiveContactAction,
  changeStageAction,
  completeNextActionAction,
  matchProjectsAction,
  mergeContactAction,
  recordQualificationAction,
  updateChecklistAction,
  updateContactPhoneAction,
  updateParticipantAction,
  updatePurchaseStructureAction,
} from "../actions";
import styles from "../leads.module.css";

function sourceLabel(source: string) {
  if (source === "whatsapp_inbound" || source === "whatsapp_device") return "WhatsApp";
  if (source === "campaign") return "Campanha";
  if (source === "meta_form") return "Formulário Meta";
  return "Origem não informada";
}

function qualificationStatusLabel(current: { human_confirmed?: boolean; state?: string } | undefined) {
  if (!current) return "Ainda não preenchido";
  if (current.human_confirmed) return "Confirmado pela equipe";
  if (current.state === "refused") return "Lead não informou";
  return "Recebido na conversa";
}

const allowedNext: Record<string, string[]> = {
  new: ["in_service", "lost"],
  in_service: ["call_scheduled", "lost"],
  call_scheduled: ["negotiation", "lost"],
  negotiation: ["proposal", "lost"],
  proposal: ["documentation", "lost"],
  documentation: ["payment", "lost"],
  payment: ["won", "lost"],
  lost: ["in_service"],
};

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const viewer = await requireActiveViewer();
  const { id } = await params;
  const feedback = await searchParams;
  const supabase = await createClient();

  const canManage = canManageTeam(viewer);
  const canEditContact = canManageCrm(viewer);
  const canManageArchive = viewer.membership?.role === "owner" ||
    (viewer.membership?.role === "manager" && viewer.permissions.includes("contacts.manage"));
  const [opportunityResult, stagesResult, reasonsResult, historyResult, actionsResult, sourcesResult, salesResult, definitionsResult, qualificationResult, matchesResult, participantsResult, contactsResult, scoresResult, checklistsResult] = await Promise.all([
    supabase
      .from("opportunities")
      .select("*, contacts!inner(id,name,status,contact_phones(*)), pipeline_stages!inner(id,name,code,position)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("pipeline_stages").select("*").eq("org_id", viewer.organization!.id).eq("is_active", true).order("position"),
    supabase.from("loss_reasons").select("id,name").eq("org_id", viewer.organization!.id).eq("is_active", true).order("name"),
    supabase.from("opportunity_stage_history").select("*, from:pipeline_stages!opportunity_stage_history_from_stage_id_org_id_fkey(name), to:pipeline_stages!opportunity_stage_history_to_stage_id_org_id_fkey(name)").eq("opportunity_id", id).order("created_at", { ascending: false }),
    supabase.from("next_actions").select("*").eq("opportunity_id", id).order("due_at"),
    supabase.from("source_attributions").select("*").eq("opportunity_id", id).order("attributed_at", { ascending: false }),
    supabase.from("sales").select("*").eq("opportunity_id", id).neq("status", "cancelled").maybeSingle(),
    supabase.from("qualification_definitions").select("*").eq("org_id", viewer.organization!.id).eq("active", true).order("suggested_order"),
    supabase.from("qualification_values").select("*").eq("opportunity_id", id),
    supabase.from("project_matches").select("*,projects!inner(name,region,neighborhood,min_price,min_down_payment,cover_storage_path)").eq("opportunity_id", id).eq("eligible", true).order("created_at", { ascending: false }).limit(4),
    supabase.from("opportunity_participants").select("id,contact_id,role,contacts!inner(id,name,contact_phones(e164,is_primary,status))").eq("opportunity_id", id).order("created_at"),
    canManage ? supabase.from("contacts").select("id,name,contact_phones(e164,is_primary,status)").eq("org_id", viewer.organization!.id).eq("status", "active").order("name").limit(500) : Promise.resolve({ data: [] }),
    supabase.from("opportunity_scores").select("score,explanation,created_at").eq("opportunity_id", id).order("created_at", { ascending: false }).limit(1),
    supabase.from("opportunity_checklists").select("*,checklist_templates!inner(name,stage_code)").eq("opportunity_id", id).order("created_at"),
  ]);

  const opportunity = opportunityResult.data;
  if (!opportunity) notFound();

  const contact = Array.isArray(opportunity.contacts) ? opportunity.contacts[0] : opportunity.contacts;
  const operationTimezone = viewer.operations.find((operation) => operation.id === opportunity.operation_id)?.timezone;
  const stage = Array.isArray(opportunity.pipeline_stages) ? opportunity.pipeline_stages[0] : opportunity.pipeline_stages;
  const phones = (contact?.contact_phones ?? []) as Array<{
    id: string;
    e164: string;
    is_primary: boolean;
    status: string;
  }>;
  const nextCodes = new Set(allowedNext[stage?.code ?? ""] ?? []);
  const availableStages = stagesResult.data?.filter((item) => nextCodes.has(item.code)) ?? [];
  const isTerminal = opportunity.status === "won";
  const latestScore = scoresResult.data?.[0];
  const scoreExplanation = latestScore?.explanation as { band?: string; missing?: string[] } | null | undefined;
  const bandLabel: Record<string, string> = { high: "Alta", normal: "Normal", followup: "Follow-up", outside_profile: "Fora do perfil" };
  const participantContactIds = new Set(participantsResult.data?.map((item) => item.contact_id));
  const mergeTargets = contactsResult.data?.filter((item) => item.id !== contact?.id) ?? [];

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} href="/app/leads"><ArrowLeft size={15} /> Voltar para leads</Link>

      <header className={styles.detailHeader}>
        <div className={styles.detailIdentity}>
          <span className={styles.largeAvatar}>{contact?.name?.slice(0, 1).toUpperCase()}</span>
          <div>
            <p className={styles.eyebrow}>Oportunidade de compra</p>
            <div className={styles.contactNameRow}><h1>{contact?.name}</h1>{canEditContact && contact ? <details className={styles.contactNameEditor}><summary aria-label="Editar nome do contato" title="Editar nome do contato"><UserRound size={14} /></summary><form action={updateContactNameAction} className={styles.contactNameForm}><input name="contactId" type="hidden" value={contact.id} /><input name="context" type="hidden" value="lead" /><input name="contextId" type="hidden" value={opportunity.id} /><label><span>Nome do contato</span><input defaultValue={contact.name} maxLength={160} minLength={2} name="name" required /></label><button type="submit">Salvar nome</button></form></details> : null}</div>
            <p>{opportunity.title} · {sourceLabel(opportunity.source)}</p>
          </div>
        </div>
        <span className={styles.currentStage}>{stage?.position}. {stage?.name}</span>
      </header>

      {feedback.erro ? <p className={styles.errorBanner}>{feedback.erro}</p> : null}
      {feedback.sucesso ? <p className={styles.successBanner}>Alteração salva com histórico e auditoria.</p> : null}

      <div className={styles.detailLayout}>
        <div className={styles.detailMain}>
          <section className={styles.detailCard}>
            <div className={styles.cardTitle}><UserRound size={18} /><h2>Contato e contexto</h2></div>
            <dl className={styles.factGrid}>
              <div><dt>WhatsApp</dt><dd><Phone size={14} /> {phones.find((item) => item.is_primary)?.e164 ?? "Não informado"}</dd></div>
              <div><dt>Responsável</dt><dd>{opportunity.assigned_membership_id ? opportunity.assigned_membership_id.slice(0, 8) : "Sem responsável"}</dd></div>
              <div><dt>Prioridade comercial</dt><dd>{latestScore ? `${bandLabel[scoreExplanation?.band ?? ""] ?? scoreExplanation?.band ?? "Em cálculo"} · ${latestScore.score}/100` : "Ainda sem sinais"}</dd></div>
              <div><dt>Estrutura da compra</dt><dd>{opportunity.unit_quantity} unidade(s) · valores {opportunity.amount_scope === "per_unit" ? "por unidade" : "totais"}</dd></div>
              <div><dt>Informações que faltam</dt><dd>{scoreExplanation?.missing?.length ? scoreExplanation.missing.join(", ") : "Nenhum dado mínimo pendente"}</dd></div>
              <div><dt>Contexto para Pedro</dt><dd>{opportunity.ai_context || "Não informado"}</dd></div>
              <div><dt>Nota interna</dt><dd>{opportunity.internal_note || "Não informada"}</dd></div>
            </dl>
            {!isTerminal ? <form action={updatePurchaseStructureAction} className={styles.matchAction}><input name="opportunityId" type="hidden" value={opportunity.id}/><input defaultValue={opportunity.unit_quantity} max="100" min="1" name="unitQuantity" type="number"/><select defaultValue={opportunity.amount_scope} name="amountScope"><option value="total">Valores totais</option><option value="per_unit">Valores por unidade</option></select><button type="submit">Atualizar estrutura</button></form> : null}
          </section>

          <section className={styles.detailCard}>
            <div className={styles.cardTitle}><UserRound size={18} /><h2>Participantes da compra</h2></div>
            <div className={styles.actionList}>
              {participantsResult.data?.map((participant) => {
                const person = Array.isArray(participant.contacts) ? participant.contacts[0] : participant.contacts;
                return <div className={styles.actionRow} key={participant.id}><span><strong>{person?.name ?? "Contato"}</strong><small>{participant.role}</small></span>{canManage && participant.role !== "primary" ? <form action={updateParticipantAction}><input name="opportunityId" type="hidden" value={opportunity.id}/><input name="contactId" type="hidden" value={participant.contact_id}/><input name="role" type="hidden" value={participant.role}/><input name="action" type="hidden" value="remove"/><button type="submit">Remover</button></form> : null}</div>;
              })}
            </div>
            {canManage ? <form action={updateParticipantAction} className={styles.matchAction}><input name="opportunityId" type="hidden" value={opportunity.id}/><input name="action" type="hidden" value="add"/><select name="contactId" required><option value="">Adicionar contato existente</option>{contactsResult.data?.filter((item) => item.id !== contact?.id && !participantContactIds.has(item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select name="role"><option value="co_buyer">Co-comprador</option><option value="influencer">Influenciador</option><option value="other">Outro</option></select><button type="submit">Adicionar</button></form> : null}
          </section>

          <section className={styles.detailCard}>
            <div className={styles.cardTitle}><CircleAlert size={18} /><h2>Qualificação</h2></div>
            <p className={styles.sectionIntro}>Preencha o que o lead já informou. Os campos restantes podem ser coletados pelo Pedro ou pela equipe ao longo da conversa.</p>
            <div className={styles.qualificationGrid}>
              {definitionsResult.data?.map((definition) => {
                const current = qualificationResult.data?.find((value) => value.definition_id === definition.id);
                const display = current?.value_number !== null && current?.value_number !== undefined
                  ? new Intl.NumberFormat("pt-BR", { style: definition.answer_type === "money" ? "currency" : "decimal", currency: "BRL" }).format(current.value_number)
                  : current?.value_text ?? (current?.state === "refused" ? "Não informado" : "Pendente");
                return (
                  <form action={recordQualificationAction} className={styles.qualificationItem} key={definition.id}>
                    <input name="opportunityId" type="hidden" value={opportunity.id} />
                    <input name="definitionId" type="hidden" value={definition.id} />
                    <input name="answerType" type="hidden" value={definition.answer_type} />
                    {current ? <input name="expectedVersion" type="hidden" value={current.version} /> : null}
                    <span><strong>{definition.name}</strong><small>{qualificationStatusLabel(current ?? undefined)}</small></span>
                    <input defaultValue={display === "Pendente" ? "" : display} name="value" placeholder={display === "Pendente" ? "Informe um valor" : display} required />
                    <button type="submit">Salvar informação</button>
                  </form>
                );
              })}
            </div>
          </section>

          <section className={styles.detailCard}>
            <div className={styles.cardTitle}><CircleAlert size={18} /><h2>Encontrar imóveis compatíveis</h2></div>
            <form action={matchProjectsAction} className={styles.matchAction}>
              <input name="opportunityId" type="hidden" value={opportunity.id} />
              <p>Precisamos de preço total e entrada para filtrar. Região, entrega e prioridade ajudam a ordenar as opções.</p>
              <button type="submit">Buscar opções compatíveis</button>
            </form>
            <div className={styles.matchList}>
              {matchesResult.data?.map((match) => {
                const project = Array.isArray(match.projects) ? match.projects[0] : match.projects;
                return <article key={match.id}><span><strong>{project?.name}</strong><small>{project?.neighborhood || project?.region} · entrada desde {project?.min_down_payment?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</small></span><span className={styles.stagePill}>#{match.rank}</span></article>;
              })}
              {!matchesResult.data?.length ? <p className={styles.mutedCopy}>Ainda não há opções. Preencha preço e entrada e faça uma nova busca.</p> : null}
            </div>
          </section>

          <section className={styles.detailCard}>
            <div className={styles.cardTitle}><CalendarClock size={18} /><h2>Próximas ações</h2></div>
            <div className={styles.actionList}>
              {actionsResult.data?.map((action) => (
                <div className={styles.actionRow} key={action.id}>
                  <span><strong>{action.description}</strong><small>{formatOperationDateTime(action.due_at, operationTimezone, { dateStyle: "medium", timeStyle: "short" })}</small></span>
                  {action.status === "open" ? (
                    <form action={completeNextActionAction}>
                      <input name="actionId" type="hidden" value={action.id} />
                      <input name="opportunityId" type="hidden" value={opportunity.id} />
                      <button className={styles.iconAction} title="Concluir" type="submit"><Check size={16} /></button>
                    </form>
                  ) : <span className={styles.doneLabel}>{action.status}</span>}
                </div>
              ))}
              {!actionsResult.data?.length ? <p className={styles.mutedCopy}>Nenhuma próxima ação registrada.</p> : null}
            </div>
          </section>

          <section className={styles.detailCard}>
            <div className={styles.cardTitle}><History size={18} /><h2>Histórico de etapa</h2></div>
            <ol className={styles.timeline}>
              {historyResult.data?.map((item) => {
                const from = Array.isArray(item.from) ? item.from[0] : item.from;
                const to = Array.isArray(item.to) ? item.to[0] : item.to;
                return (
                  <li key={item.id}>
                    <span className={styles.timelineDot} />
                    <div><strong>{from?.name ? `${from.name} → ` : ""}{to?.name}</strong><small>{item.reason || "Mudança registrada"} · v{item.opportunity_version}</small></div>
                    <time>{formatOperationDateTime(item.created_at, operationTimezone)}</time>
                  </li>
                );
              })}
            </ol>
          </section>

          {checklistsResult.data?.map((checklist) => {
            const template = Array.isArray(checklist.checklist_templates) ? checklist.checklist_templates[0] : checklist.checklist_templates;
            const items = Array.isArray(checklist.items_snapshot) ? checklist.items_snapshot as Array<{ id: string; label: string; required: boolean }> : [];
            const completion = (checklist.completion ?? {}) as Record<string, { status?: string; note?: string }>;
            return <section className={styles.detailCard} key={checklist.id}><div className={styles.cardTitle}><Check size={18}/><h2>{template?.name ?? "Checklist"}</h2></div><div className={styles.actionList}>{items.map((item) => { const state=completion[item.id]; return <div className={styles.actionRow} key={item.id}><span><strong>{item.label}</strong><small>{item.required ? "Obrigatório" : "Opcional"} · {state?.status ?? "pendente"}{state?.note ? ` · ${state.note}` : ""}</small></span><form action={updateChecklistAction}><input name="opportunityId" type="hidden" value={opportunity.id}/><input name="checklistId" type="hidden" value={checklist.id}/><input name="itemId" type="hidden" value={item.id}/>{state ? <><input name="action" type="hidden" value="reopen"/><button type="submit">Reabrir</button></> : <><select name="action"><option value="complete">Concluir</option>{canManage ? <option value="waive">Dispensar</option> : null}</select><input name="note" placeholder="Observação / motivo"/><button type="submit">Salvar</button></>}</form></div>; })}</div></section>;
          })}
        </div>

        <aside className={styles.detailAside}>
          <section className={styles.stageFormCard}>
            <div className={styles.cardTitle}><CircleAlert size={18} /><h2>Atualizar etapa</h2></div>
            {isTerminal ? (
              <p className={styles.terminalMessage}>Venda concluída é um estado imutável. Uma nova decisão de compra cria outra oportunidade.</p>
            ) : (
              <form action={changeStageAction} className={styles.stageForm}>
                <input name="opportunityId" type="hidden" value={opportunity.id} />
                <input name="expectedVersion" type="hidden" value={opportunity.version} />
                <label><span>Próxima etapa</span><select name="targetStageId" required>{availableStages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label><span>Motivo / correção</span><textarea name="reason" rows={2} /></label>
                <label><span>Motivo de perda</span><select name="lossReasonId"><option value="">Somente se perdido</option>{reasonsResult.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <div className={styles.inlineFields}>
                  <label><span>Mês da venda</span><input max="12" min="1" name="saleMonth" type="number" /></label>
                  <label><span>Ano</span><input min="2020" name="saleYear" type="number" /></label>
                </div>
                <label><span>Empreendimento vendido</span><input name="saleProjectName" /></label>
                <div className={styles.inlineFields}><label><span>Unidade</span><input name="saleUnitReference" /></label><label><span>Quantidade</span><input min="1" name="saleUnitQuantity" type="number" /></label></div>
                <label><span>Valor</span><input inputMode="decimal" name="saleValue" /></label>
                <label><span>Próxima ação</span><input name="nextActionDescription" /></label>
                <label><span>Prazo</span><input name="nextActionDueAt" type="datetime-local" /></label>
                <button className={styles.primaryButton} type="submit">Confirmar mudança</button>
              </form>
            )}
          </section>

          <section className={styles.compactCard}>
            <h3>Origem</h3>
            {sourcesResult.data?.map((source) => <p key={source.id}><strong>{source.source}</strong><span>{source.attribution_type} · {formatOperationDateTime(source.attributed_at, operationTimezone, { dateStyle: "short" })}</span></p>)}
          </section>

          {canManageArchive && contact ? (
            <section className={styles.stageFormCard}>
              <div className={styles.cardTitle}><UserRound size={18}/><h2>{contact.status === "archived" ? "Restaurar lead" : "Arquivar lead"}</h2></div>
              <p className={styles.terminalMessage}>O arquivamento preserva o histórico e interrompe Pedro, campanhas e follow-ups. Ao restaurar, você escolhe como o atendimento volta.</p>
              <form action={archiveContactAction} className={styles.stageForm}>
                <input name="opportunityId" type="hidden" value={opportunity.id}/>
                <input name="contactId" type="hidden" value={contact.id}/>
                <input name="action" type="hidden" value={contact.status === "archived" ? "restore" : "archive"}/>
                {contact.status === "archived" ? <label><span>Após restaurar</span><select defaultValue="manual" name="resumeMode"><option value="manual">Manter atendimento manual</option><option value="pedro">Devolver ao Pedro</option><option value="followup">Devolver ao Pedro e executar follow-up</option></select></label> : <input name="resumeMode" type="hidden" value="manual"/>}
                <label><span>Motivo auditável</span><textarea maxLength={500} minLength={3} name="reason" required rows={2}/></label>
                <button type="submit">{contact.status === "archived" ? "Restaurar lead" : "Arquivar e pausar automações"}</button>
              </form>
            </section>
          ) : null}

          {canManage ? <section className={styles.stageFormCard}><div className={styles.cardTitle}><Phone size={18}/><h2>Telefones</h2></div><div className={styles.actionList}>{phones.filter((phone) => phone.status === "active").map((phone) => <div className={styles.actionRow} key={phone.e164}><span><strong>{phone.e164}</strong><small>{phone.is_primary ? "Principal" : "Alternativo"}</small></span><form action={updateContactPhoneAction}><input name="opportunityId" type="hidden" value={opportunity.id}/><input name="contactId" type="hidden" value={contact?.id}/><input name="phoneId" type="hidden" value={phone.id}/><select name="action"><option value="set_primary">Tornar principal</option><option value="deactivate">Desativar</option><option value="mark_wrong">Número errado</option></select><button type="submit">Aplicar</button></form></div>)}</div><form action={addContactPhoneAction} className={styles.stageForm}><input name="opportunityId" type="hidden" value={opportunity.id}/><input name="contactId" type="hidden" value={contact?.id}/><label><span>Novo telefone</span><input name="phone" placeholder="(11) 99999-9999" required/></label><label><input name="makePrimary" type="checkbox"/> Tornar principal</label><button type="submit">Adicionar telefone</button></form></section> : null}

          {canManage && mergeTargets.length ? <section className={styles.stageFormCard}><div className={styles.cardTitle}><UserRound size={18}/><h2>Fundir duplicado</h2></div><p className={styles.terminalMessage}>Move telefones, oportunidades e conversas para o contato escolhido. Opt-out sempre prevalece e dois contatos com conversa ativa não podem ser fundidos.</p><form action={mergeContactAction} className={styles.stageForm}><input name="opportunityId" type="hidden" value={opportunity.id}/><input name="sourceContactId" type="hidden" value={contact?.id}/><label><span>Contato canônico</span><select name="targetContactId" required><option value="">Selecione</option>{mergeTargets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Motivo auditável</span><textarea name="reason" required rows={2}/></label><button type="submit">Confirmar fusão</button></form></section> : null}

          {salesResult.data ? (
            <section className={styles.saleCard}><strong>Venda registrada</strong><span>{salesResult.data.sale_month}/{salesResult.data.sale_year}</span><span>{salesResult.data.project_name || "Empreendimento não informado"}</span></section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
