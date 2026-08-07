import {
  CheckCircle2,
  Clock3,
  PhoneCall,
  ShieldAlert,
  Video,
} from "lucide-react";

import { requireActiveViewer } from "@/lib/auth/session";
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

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const viewer = await requireActiveViewer();
  const feedback = await searchParams;
  const supabase = await createClient();
  const operation =
    viewer.operations.find((item) => item.is_default) ?? viewer.operations[0];
  const canManage =
    viewer.membership?.role === "owner" ||
    viewer.permissions.includes("pipeline.manage");
  const [
    { data: settings },
    { data: rules },
    { data: exceptions },
    { data: calls },
    { data: offers },
    { data: opportunities },
  ] = await Promise.all([
    supabase
      .from("membership_call_settings")
      .select("*")
      .eq("membership_id", viewer.membership!.id)
      .maybeSingle(),
    supabase
      .from("availability_rules")
      .select("*")
      .eq("membership_id", viewer.membership!.id)
      .eq("active", true)
      .order("weekday")
      .order("start_time"),
    supabase
      .from("availability_exceptions")
      .select("*")
      .eq("membership_id", viewer.membership!.id)
      .gte("ends_at", new Date().toISOString())
      .order("starts_at")
      .limit(20),
    supabase
      .from("calls")
      .select("*,opportunities(title,contacts(name))")
      .order("starts_at", { ascending: true })
      .limit(50),
    supabase
      .from("call_offers")
      .select(
        "*,calls!inner(id,starts_at,format,status,version,opportunities(title,contacts(name)))",
      )
      .eq("recipient_membership_id", viewer.membership!.id)
      .eq("status", "pending")
      .order("expires_at"),
    canManage
      ? supabase
          .from("opportunities")
          .select("id,title,version,contacts(name),pipeline_stages(code,name)")
          .eq("org_id", viewer.organization!.id)
          .eq("status", "open")
          .order("last_activity_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
  ]);
  const ready = Boolean(
    viewer.profile?.whatsapp_e164 &&
    rules?.length &&
    settings?.can_receive_calls,
  );
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>20 minutos + 10 de intervalo</p>
          <h1>Agenda e calls</h1>
          <p>
            Ofertas não bloqueiam horário. O primeiro aceite válido cria a única
            atribuição ativa.
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
          <section className={styles.panel}>
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
                        · {call.format}
                      </small>
                    </span>
                    {call.video_link ? (
                      <a href={call.video_link} rel="noreferrer" target="_blank">
                        Abrir videochamada
                      </a>
                    ) : call.format === "video" ? (
                      <small>Link pendente</small>
                    ) : null}
                    <b>{call.status}</b>
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
                        <summary>Informar resultado</summary>
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
                          <button>Registrar</button>
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
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Sua disponibilidade</h2>
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
              <button>Salvar</button>
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
                <button>Salvar exceção</button>
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
                    –
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
                <h2>Separar call</h2>
              </div>
              <label>
                <span>Oportunidade</span>
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
              <button>Separar horário</button>
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
