import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import Link from "next/link";

import { requireActiveViewer } from "@/lib/auth/session";
import type { Database } from "@/lib/database.types";
import { measureServerTask } from "@/lib/observability/server-performance";
import { createClient } from "@/lib/supabase/server";
import { formatOperationDateTime } from "@/lib/time/operation-format";
import styles from "../../operations.module.css";

const PAGE_SIZE = 30;
const QUERY_LIMIT = 250;

type AuditWorkspacePayload = {
  authorized: boolean;
  events: Database["public"]["Functions"]["list_audit_events"]["Returns"];
};

function positivePage(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const supabase = await createClient();
  const [viewer, query, { data, error }] = await Promise.all([
    requireActiveViewer(),
    searchParams,
    measureServerTask("audit.bootstrap", () => supabase.rpc("audit_workspace_bootstrap", {
      p_limit: QUERY_LIMIT,
    })),
  ]);
  const allowed = viewer.membership?.role === "owner"
    || viewer.membership?.role === "manager"
    || viewer.permissions.includes("reports.view");

  if (!allowed) {
    return <div className={styles.page}><p className={styles.error}>Sem permissão para consultar auditoria.</p></div>;
  }

  const operation = viewer.operations.find((item) => item.is_default) ?? viewer.operations[0];
  const payload = (data ?? {}) as unknown as AuditWorkspacePayload;
  const allEvents = payload.events ?? [];
  const pageCount = Math.max(1, Math.ceil(allEvents.length / PAGE_SIZE));
  const currentPage = Math.min(positivePage(query.pagina), pageCount);
  const visibleEvents = allEvents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const auditHref = (page: number) => page > 1
    ? `/app/configuracoes/auditoria?pagina=${page}`
    : "/app/configuracoes/auditoria";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Rastreabilidade</p>
          <h1>Auditoria</h1>
          <p>Ações humanas e automáticas registradas pelo banco.</p>
        </div>
        <span className={styles.badge}><ScrollText aria-hidden="true" size={14} /> {PAGE_SIZE} por página</span>
      </header>

      {error ? <p className={styles.error}>Não foi possível carregar a auditoria.</p> : null}

      <section className={styles.panel}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead><tr><th>Quando</th><th>Ação</th><th>Entidade</th><th>Ator</th><th>Metadados</th></tr></thead>
            <tbody>
              {visibleEvents.map((event) => (
                <tr key={event.id}>
                  <td>{formatOperationDateTime(event.occurred_at, operation?.timezone)}</td>
                  <td>{event.action}</td>
                  <td>{event.entity_type}{event.entity_id ? ` · ${event.entity_id.slice(0, 8)}` : ""}</td>
                  <td>{event.actor_type}{event.actor_user_id ? ` · ${event.actor_user_id.slice(0, 8)}` : ""}</td>
                  <td><code>{JSON.stringify(event.metadata)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!visibleEvents.length && !error ? <p className={styles.empty}>Nenhum evento visível.</p> : null}

        {allEvents.length ? (
          <footer className={styles.centralPagination}>
            <span>Página {currentPage} de {pageCount}</span>
            <div>
              {currentPage > 1
                ? <Link href={auditHref(currentPage - 1)}><ChevronLeft aria-hidden="true" size={15} /> Anterior</Link>
                : <span aria-disabled="true"><ChevronLeft aria-hidden="true" size={15} /> Anterior</span>}
              {currentPage < pageCount
                ? <Link href={auditHref(currentPage + 1)}>Próxima <ChevronRight aria-hidden="true" size={15} /></Link>
                : <span aria-disabled="true">Próxima <ChevronRight aria-hidden="true" size={15} /></span>}
            </div>
          </footer>
        ) : null}
      </section>
    </div>
  );
}
