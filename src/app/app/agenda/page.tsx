import {
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  PhoneCall,
  ShieldAlert,
  UserRoundSearch,
  Video,
} from "lucide-react";

import { requireActiveViewer } from "@/lib/auth/session";
import type { Tables } from "@/lib/database.types";
import { measureServerTask } from "@/lib/observability/server-performance";
import { createClient } from "@/lib/supabase/server";
import {
  acceptOfferAction,
  addAvailabilityExceptionAction,
  createCallAction,
  declineOfferAction,
  distributeCallAction,
  recordCallResultAction,
  returnCallAction,
  saveAvailabilityAction,
  updateCallSettingsAction,
  updateCallVideoLinkAction,
} from "./actions";
import AvailabilityEditor from "./availability-editor";
import styles from "./agenda.module.css";

const weekdays = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

type AgendaWorkspacePayload = {
  authorized: boolean;
  settings: Tables<"membership_call_settings"> | null;
  rules: Tables<"availability_rules">[];
  exceptions: Tables<"availability_exceptions">[];
  calls: Array<Tables<"calls"> & {
    opportunities: { title: string; contacts: { name: string } | null } | null;
  }>;
  offers: Array<Tables<"call_offers"> & {
    calls: Tables<"calls"> & {
      opportunities: { title: string; contacts: { name: string } | null } | null;
    };
  }>;
  opportunities: Array<Pick<Tables<"opportunities">, "id" | "title" | "version"> & {
    contacts: { name: string } | null;
    pipeline_stages: { code: string; name: string } | null;
  }>;
};

function callStatusLabel(status: string) {
  const labels: Record<string, string> = {
    awaiting_distribution: "Aguardando distribuição",
    unassigned_alerted: "Precisa de responsável",
    assigned: "Atribuída",
    completed: "Concluída",
    no_show: "Não compareceu",
    cancelled: "Cancelada",
    rescheduled: "Reagendada",
  };
  return labels[status] ?? "Em acompanhamento";
}

function callFormatLabel(format: string) {
  if (format === "video") return "Vídeo";
  if (format === "phone") return "Ligação";
  return "Formato a combinar";
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const workspacePromise = (async () => {
    const supabase = await createClient();
    return measureServerTask(
      "agenda.workspace",
      () => supabase.rpc("agenda_workspace_bootstrap", {}),
    );
  })();
  const [viewer, feedback, workspaceResult] = await Promise.all([
    requireActiveViewer(),
    searchParams,
    workspacePromise,
  ]);
  if (workspaceResult.error) {
    console.error("Failed to load Agenda workspace", workspaceResult.error);
    throw new Error("Não foi possível carregar a Agenda.");
  }
  const workspace = workspaceResult.data as unknown as AgendaWorkspacePayload;
  const {
    settings,
    rules,
    exceptions,
    calls,
    offers,
    opportunities,
  } = workspace;
  const operation =
    viewer.operations.find((item) => item.is_default) ?? viewer.operations[0];
  const canManage =
    viewer.membership?.role === "owner" ||
    viewer.permissions.includes("pipeline.manage");
  const ready = Boolean(
    viewer.profile?.whatsapp_e164 &&
    rules.length &&
    settings?.can_receive_calls,
  );
  const now = new Date();
  const timeZone = operation?.timezone ?? "America/Sao_Paulo";
  const dayFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayKey = dayFormatter.format(now);
  const upcomingCalls = calls.filter((call) => new Date(call.starts_at) > now && !["completed", "no_show", "cancelled"].includes(call.status));
  const todayCalls = calls.filter((call) => dayFormatter.format(new Date(call.starts_at)) === todayKey);
  const availableDays = new Set(rules.map((rule) => rule.weekday)).size;
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Agenda da operação</p>
          <h1>Agenda</h1>
          <p>
            Organize sua disponibilidade, acompanhe os horários e registre o resultado de cada call.
          </p>
        </div>
        <span className={ready ? styles.ready : styles.notReady}>
          {ready ? <CheckCircle2 size={15} /> : <ShieldAlert size={15} />}{" "}
          {ready ? "Pronto para receber" : "Cadastro incompleto"}
        </span>
      </header>
      {feedback.erro ? <p className={styles.error}>{feedback.erro}</p> : null}
      {feedback.sucesso ? (
        <p className={styles.success}>{feedback.sucesso}</p>
      ) : null}
      <nav aria-label="Áreas da Agenda" className={styles.sectionTabs}>
        <a href="#proximas-calls">Compromissos</a>
        <a href="#disponibilidade">Disponibilidade</a>
      </nav>
      <section className={styles.agendaSummary} aria-label="Resumo da agenda">
        <span><CalendarDays aria-hidden="true" size={17} /><small>Hoje</small><strong>{todayCalls.length}</strong><b>compromissos</b></span>
        <span><CalendarCheck2 aria-hidden="true" size={17} /><small>Próximas</small><strong>{upcomingCalls.length}</strong><b>calls abertas</b></span>
        <span><UserRoundSearch aria-hidden="true" size={17} /><small>Ofertas</small><strong>{offers?.length ?? 0}</strong><b>aguardando resposta</b></span>
        <span><Clock3 aria-hidden="true" size={17} /><small>Disponibilidade</small><strong>{availableDays}</strong><b>dias configurados</b></span>
      </section>
      {offers?.length ? (
        <section className={styles.offers}>
          <h2>Ofertas para você</h2>
          {offers.map((offer) => {
            const call = offer.calls as {
              id: string;
              starts_at: string;
              format: string;
              status: string;
              version: number;
              opportunities: {
                title: string;
                contacts: { name: string } | null;
              } | null;
            };
            return (
              <article key={offer.id}>
                <span>
                  <Clock3 size={18} />
                  <strong>
                    {new Date(call.starts_at).toLocaleString("pt-BR", {
                      timeZone: operation?.timezone,
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </strong>
                  <small>
                    {offer.offer_type} · expira{" "}
                    {new Date(offer.expires_at).toLocaleTimeString("pt-BR", {
                      timeZone: operation?.timezone,
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                </span>
                <form action={acceptOfferAction}>
                  <input name="callId" type="hidden" value={call.id} />
                  <input name="offerId" type="hidden" value={offer.id} />
                  <input
                    name="expectedVersion"
                    type="hidden"
                    value={call.version}
                  />
                  <button>Aceitar call</button>
                </form>
                <form action={declineOfferAction}><input name="callId" type="hidden" value={call.id} /><input name="offerId" type="hidden" value={offer.id} /><button>Recusar</button></form>
              </article>
            );
          })}
        </section>
      ) : null}
      <div className={styles.layout}>
        <main className={styles.main}>
          <section className={styles.panel} id="proximas-calls">
            <div className={styles.panelHeader}>
              <h2>Próximas calls</h2>
              <span>{calls?.length ?? 0} visíveis</span>
            </div>
            <div className={styles.callList}>
              {calls?.map((call) => {
                const opportunity = call.opportunities as {
                  title: string;
                  contacts: { name: string } | null;
                } | null;
                const past = new Date(call.starts_at) <= new Date();
                const canSetLink =
                  call.format === "video" &&
                  !["completed", "no_show", "cancelled"].includes(call.status) &&
                  (canManage ||
                    call.assigned_membership_id === viewer.membership?.id);
                return (
                  <article key={call.id}>
                    <span className={styles.callIcon}>
                      {call.format === "video" ? (
                        <Video size={17} />
                      ) : (
                        <PhoneCall size={17} />
                      )}
                    </span>
                    <span>
                      <strong>
                        {opportunity?.contacts?.name ??
                          opportunity?.title ??
                          "Lead"}
                      </strong>
                      <small>
                        {new Date(call.starts_at).toLocaleString("pt-BR", {
                          timeZone: operation?.timezone,
                          dateStyle: "short",
                          timeStyle: "short",
                        })}{" "}
                        · {callFormatLabel(call.format)}
                      </small>
                    </span>
                    {call.video_link ? (
                      <a href={call.video_link} rel="noreferrer" target="_blank">
                        Abrir videochamada
                      </a>
                    ) : call.format === "video" ? (
                      <small>Link pendente</small>
                    ) : null}
                    <b>{callStatusLabel(call.status)}</b>
                    {call.status === "assigned" && call.assigned_membership_id === viewer.membership?.id && !past ? <form action={returnCallAction}><input name="callId" type="hidden" value={call.id} /><button>Devolver call</button></form> : null}
                    {canSetLink ? (
                      <details className={styles.result}>
                        <summary>
                          {call.video_link ? "Trocar link" : "Adicionar link"}
                        </summary>
                        <form action={updateCallVideoLinkAction}>
                          <input name="callId" type="hidden" value={call.id} />
                          <input
                            name="expectedVersion"
                            type="hidden"
                            value={call.version}
                          />
                          <input
                            name="videoLink"
                            placeholder="https://meet.google.com/..."
                            required
                            type="url"
                          />
                          <button>Salvar link</button>
                        </form>
                      </details>
                    ) : null}
                    {canManage &&
                    ["awaiting_distribution", "unassigned_alerted"].includes(
                      call.status,
                    ) ? (
                      <form action={distributeCallAction}>
                        <input name="callId" type="hidden" value={call.id} />
                        <button>Distribuir</button>
                      </form>
                    ) : null}
                    {past && call.status === "assigned" ? (
                      <details className={styles.result}>
                          <summary>Registrar resultado da call</summary>
                        <form action={recordCallResultAction}>
                          <input name="callId" type="hidden" value={call.id} />
                          <input
                            name="expectedVersion"
                            type="hidden"
                            value={call.version}
                          />
                          <select name="result">
                            <option value="start_negotiation">
                              Iniciar negociação
                            </option>
                            <option value="lost">Perdido</option>
                            <option value="no_show">No-show</option>
                            <option value="no_result">Sem resultado</option>
                            <option value="reschedule">
                              Reagendar solicitado
                            </option>
                          </select>
                          <textarea
                            name="context"
                            placeholder="Resumo e contexto (obrigatório em negociação)"
                          />
                          <input
                            name="nextAction"
                            placeholder="Próxima ação (obrigatória em negociação)"
                          />
                          <label>
                            Prazo da próxima ação
                            <input
                              name="nextActionDueAt"
                              type="datetime-local"
                            />
                          </label>
                          <div className={styles.inline}>
                            <input
                              max="12"
                              min="1"
                              name="purchaseMonth"
                              placeholder="Mês da compra"
                              type="number"
                            />
                            <input
                              min="2020"
                              name="purchaseYear"
                              placeholder="Ano da compra"
                              type="number"
                            />
                          </div>
                          <button>Salvar resultado</button>
                        </form>
                      </details>
                    ) : null}
                  </article>
                );
              })}
              {!calls?.length ? (
                <p className={styles.empty}>Nenhuma call ou oferta visível.</p>
              ) : null}
            </div>
          </section>
          <section className={styles.panel} id="disponibilidade">
            <div className={styles.panelHeader}>
                <h2>Quando você pode receber calls</h2>
              <span>
                {viewer.profile?.whatsapp_e164 ?? "WhatsApp pendente"}
              </span>
            </div>
            <form
              action={updateCallSettingsAction}
              className={styles.inlineForm}
            >
              <label>
                <input
                  name="canReceiveCalls"
                  type="checkbox"
                  defaultChecked={settings?.can_receive_calls}
                />{" "}
                Quero receber calls
              </label>
              {canManage ? (
                <label>
                  <input
                    name="preferredReceiver"
                    type="checkbox"
                    defaultChecked={settings?.is_preferred_receiver}
                  />{" "}
                  Corretor preferencial
                </label>
              ) : null}
              <label>
                <input
                  name="urgentAlerts"
                  type="checkbox"
                  defaultChecked={settings?.receive_urgent_call_alerts}
                />{" "}
                Alertas urgentes
              </label>
              <button>Salvar preferências</button>
            </form>
            <AvailabilityEditor
              action={saveAvailabilityAction}
              rules={
                rules?.map((rule) => ({
                  id: rule.id,
                  weekday: rule.weekday,
                  start_time: String(rule.start_time),
                  end_time: String(rule.end_time),
                })) ?? []
              }
              timezone={operation?.timezone ?? "America/Sao_Paulo"}
              weekdays={weekdays}
            />
            <details className={styles.exception}>
              <summary>Adicionar exceção de agenda</summary>
              <form action={addAvailabilityExceptionAction}>
                <select name="availability">
                  <option value="unavailable">Indisponível</option>
                  <option value="available">Disponível fora da regra</option>
                </select>
                <input name="startsAt" type="datetime-local" required />
                <input name="endsAt" type="datetime-local" required />
                <input name="reason" placeholder="Motivo" />
                <button>Salvar exceção de agenda</button>
              </form>
            </details>
            {exceptions?.length ? (
              <div className={styles.exceptionList}>
                {exceptions.map((item) => (
                  <span key={item.id}>
                    <strong>
                      {item.availability === "unavailable"
                        ? "Bloqueado"
                        : "Disponível"}
                    </strong>
                    {new Date(item.starts_at).toLocaleString("pt-BR", {
                      timeZone: operation?.timezone,
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                    até
                    {new Date(item.ends_at).toLocaleString("pt-BR", {
                      timeZone: operation?.timezone,
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                    <small>{item.reason}</small>
                  </span>
                ))}
              </div>
            ) : null}
          </section>
        </main>
        {canManage ? (
          <aside>
            <form action={createCallAction} className={styles.createForm}>
              <div>
                <p className={styles.eyebrow}>Horário alinhado</p>
                <h2>Agendar uma call</h2>
              </div>
              <label>
                <span>Lead / oportunidade</span>
                <select name="opportunityRef" required>
                  <option value="">Selecione</option>
                  {opportunities?.map((opportunity) => {
                    const contact = opportunity.contacts as {
                      name: string;
                    } | null;
                    return (
                      <option
                        key={opportunity.id}
                        value={`${opportunity.id}:${opportunity.version}`}
                      >
                        {contact?.name ?? opportunity.title}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label>
                <span>Data e hora</span>
                <input name="startsAt" type="datetime-local" required />
              </label>
              <label>
                <span>Formato</span>
                <select name="format">
                  <option value="video">Vídeo</option>
                  <option value="phone">Ligação</option>
                  <option value="unknown">Perguntar depois</option>
                </select>
              </label>
              <label className={styles.check}>
                <input name="leadConfirmed" type="checkbox" /> O lead aceitou
                claramente este horário
              </label>
              <button>Agendar horário</button>
              <p className={styles.help}>
                Abaixo de 1 hora, o lead não recebe confirmação automática e o
                gestor é alertado.
              </p>
            </form>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
