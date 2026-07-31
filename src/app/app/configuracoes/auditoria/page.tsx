import { ScrollText } from "lucide-react";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import styles from "../../operations.module.css";

export default async function AuditPage() {
  const viewer = await requireActiveViewer();
  const allowed = viewer.membership?.role === "owner" || viewer.membership?.role === "manager" || viewer.permissions.includes("reports.view");
  if (!allowed) return <div className={styles.page}><p className={styles.error}>Sem permissão para consultar auditoria.</p></div>;
  const supabase = await createClient();
  const { data: events, error } = await supabase.rpc("list_audit_events", { p_org_id: viewer.organization!.id, p_limit: 250 });
  return <div className={styles.page}><header className={styles.header}><div><p className={styles.eyebrow}>Rastreabilidade</p><h1>Auditoria</h1><p>Ações humanas e automáticas registradas pelo banco.</p></div><ScrollText /></header>{error ? <p className={styles.error}>Não foi possível carregar a auditoria.</p> : null}<section className={styles.panel}><table className={styles.table}><thead><tr><th>Quando</th><th>Ação</th><th>Entidade</th><th>Ator</th><th>Metadados</th></tr></thead><tbody>{events?.map((event)=><tr key={event.id}><td>{new Date(event.occurred_at).toLocaleString("pt-BR")}</td><td>{event.action}</td><td>{event.entity_type}{event.entity_id ? ` · ${event.entity_id.slice(0,8)}` : ""}</td><td>{event.actor_type}{event.actor_user_id ? ` · ${event.actor_user_id.slice(0,8)}` : ""}</td><td><code>{JSON.stringify(event.metadata)}</code></td></tr>)}</tbody></table>{!events?.length&&!error?<p className={styles.empty}>Nenhum evento visível.</p>:null}</section></div>;
}
