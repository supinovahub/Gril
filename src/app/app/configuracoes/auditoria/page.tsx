import { ArrowLeft, ArrowRight, Search, ScrollText } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import styles from "../../operations.module.css";

const pageSize = 30;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; entity?: string; actor?: string }>;
}) {
  const viewer = await requireActiveViewer();
  const allowed = viewer.membership?.role === "owner" || viewer.membership?.role === "manager" || viewer.permissions.includes("reports.view");
  if (!allowed) return <div className={styles.page}><p className={styles.error}>Sem permissão para consultar auditoria.</p></div>;

  const params = await searchParams;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Math.max(Number.isFinite(requestedPage) ? requestedPage : 1, 1);
  const query = params.q?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const entity = params.entity?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const actor = params.actor?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const supabase = await createClient();
  const operation = viewer.operations.find((item) => item.is_default) ?? viewer.operations[0];
  const { data: rawEvents, error } = await supabase.rpc("list_audit_events", {
    p_org_id: viewer.organization!.id,
    p_limit: Math.min(page * pageSize + pageSize + 1, 500),
  });
  const events = (rawEvents ?? []).filter((event) => {
    const searchable = `${event.action} ${event.entity_type} ${event.actor_type} ${event.entity_id ?? ""}`.toLocaleLowerCase("pt-BR");
    return (!query || searchable.includes(query))
      && (!entity || event.entity_type.toLocaleLowerCase("pt-BR").includes(entity))
      && (!actor || event.actor_type.toLocaleLowerCase("pt-BR").includes(actor));
  });
  const totalPages = Math.max(1, Math.ceil(events.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageEvents = events.slice((safePage - 1) * pageSize, safePage * pageSize);
  const buildHref = (nextPage: number) => {
    const search = new URLSearchParams();
    if (query) search.set("q", params.q ?? "");
    if (entity) search.set("entity", params.entity ?? "");
    if (actor) search.set("actor", params.actor ?? "");
    search.set("page", String(nextPage));
    return `/app/configuracoes/auditoria?${search.toString()}`;
  };

  return (
    <div className={styles.page}>
      <PageHeader eyebrow="Administração" title="Auditoria" description="Ações humanas e automáticas registradas pelo banco, com leitura paginada e filtros rápidos.">
        <StatusBadge tone="neutral"><ScrollText size={14} /> {pageSize} por página</StatusBadge>
      </PageHeader>
      {error ? <p className={styles.error}>Não foi possível carregar a auditoria.</p> : null}
      <section className={styles.auditPanel}>
        <form className={styles.auditFilters} action="/app/configuracoes/auditoria">
          <label><Search size={14} aria-hidden="true" /><span className="srOnly">Buscar</span><input defaultValue={params.q} name="q" placeholder="Buscar ação, entidade ou ID" /></label>
          <input defaultValue={params.entity} name="entity" placeholder="Entidade" />
          <input defaultValue={params.actor} name="actor" placeholder="Ator" />
          <button type="submit">Filtrar</button>
        </form>
        <div className={styles.auditTableWrap}>
          <table className={styles.auditTable}>
            <thead><tr><th>Quando</th><th>Ação</th><th>Entidade</th><th>Ator</th><th>Detalhes</th></tr></thead>
            <tbody>
              {pageEvents.map((event) => (
                <tr key={event.id}>
                  <td><time>{new Intl.DateTimeFormat("pt-BR", { timeZone: operation?.timezone, dateStyle: "short", timeStyle: "short" }).format(new Date(event.occurred_at))}</time></td>
                  <td><StatusBadge tone="neutral">{event.action.replaceAll("_", " ")}</StatusBadge></td>
                  <td><strong>{event.entity_type}</strong>{event.entity_id ? <small>{event.entity_id.slice(0, 8)}</small> : null}</td>
                  <td><strong>{event.actor_type}</strong>{event.actor_user_id ? <small>{event.actor_user_id.slice(0, 8)}</small> : null}</td>
                  <td><details className={styles.metadata}><summary>Ver metadata</summary><code>{JSON.stringify(event.metadata, null, 2)}</code></details></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!pageEvents.length && !error ? <p className={styles.empty}>Nenhum evento corresponde aos filtros.</p> : null}
        </div>
        <footer className={styles.logPagination}>
          <span>{events.length ? `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, events.length)} eventos carregados` : "0 eventos"}</span>
          <div><Link aria-disabled={safePage <= 1} className={safePage <= 1 ? styles.paginationDisabled : styles.paginationButton} href={buildHref(Math.max(1, safePage - 1))}><ArrowLeft size={13} /> Anterior</Link><span>Página {safePage} de {totalPages}</span><Link aria-disabled={safePage >= totalPages} className={safePage >= totalPages ? styles.paginationDisabled : styles.paginationButton} href={buildHref(Math.min(totalPages, safePage + 1))}>Próxima <ArrowRight size={13} /></Link></div>
        </footer>
      </section>
    </div>
  );
}
