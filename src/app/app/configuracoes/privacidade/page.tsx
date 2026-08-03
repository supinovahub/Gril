import { ShieldCheck } from "lucide-react";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createPrivacyRequestAction, executePrivacyAction, reviewPrivacyRequestAction } from "./actions";
import styles from "../../operations.module.css";

export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const viewer = await requireActiveViewer();
  const feedback = await searchParams;
  const supabase = await createClient();
  const [{ data: requests }, { data: policies }, { data: contacts }] = await Promise.all([
    supabase.from("privacy_requests").select("*,contacts(name)").eq("org_id", viewer.organization!.id).order("created_at", { ascending: false }),
    supabase.from("retention_policies").select("*").eq("org_id", viewer.organization!.id),
    supabase.from("contacts").select("id,name").eq("org_id", viewer.organization!.id).eq("status", "active").order("name").limit(500),
  ]);

  return <div className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>Privacidade e retenção</p><h1>Solicitações de titular</h1><p>Decisões são auditadas; exclusão ou anonimização só pode ser concluída com evidência e sem bloqueio legal.</p></div><ShieldCheck /></header>
    {feedback.erro ? <p className={styles.error}>{feedback.erro}</p> : null}
    {feedback.sucesso ? <p className={styles.success}>Decisão registrada.</p> : null}
    <section className={styles.metrics}>{policies?.map((policy) => <div className={styles.metric} key={policy.id}><small>{policy.data_class}</small><strong>{policy.retention_days} dias</strong><span>{policy.action}</span></div>)}</section>
    <div className={styles.layout}>
      <main><section className={styles.panel}><div className={styles.panelHeader}><h2>Fila</h2><span>{requests?.length ?? 0}</span></div><div className={styles.list}>
        {requests?.map((request) => {
          const contact = request.contacts as { name: string } | null;
          const available = request.status === "open" ? ["start_review", "legal_hold", "reject"]
            : request.status === "reviewing" ? ["legal_hold", "complete", "reject"]
              : request.status === "blocked_legal_hold" ? ["release_hold", "reject"] : [];
          return <article className={styles.item} key={request.id}><span><strong>{contact?.name ?? "Contato"}</strong><small>{request.request_type} · vence {new Date(request.due_at).toLocaleDateString("pt-BR")}</small><small>{request.resolution_notes ?? "Automação pausada enquanto a solicitação estiver aberta"}</small></span><div><b>{request.status}</b>{available.length ? <form action={reviewPrivacyRequestAction}><input name="privacyRequestId" type="hidden" value={request.id} /><textarea name="notes" placeholder="Justificativa ou evidência" required rows={2} /><div className={styles.actions}>{available.map((action) => <button name="action" type="submit" value={action} key={action}>{action.replaceAll("_", " ")}</button>)}</div></form> : null}
            {!['completed','rejected'].includes(request.status) ? <form action={executePrivacyAction}><input name="privacyRequestId" type="hidden" value={request.id} /><select name="action"><option value="archive">Arquivar lead</option><option value="resume_ai">Voltar ao Pedro</option><option value="correct">Corrigir nome</option><option value="anonymize">Anonimizar</option><option value="delete">Excluir identificadores e conteúdo</option><option value="retain_close">Reter por exceção e fechar</option></select><input name="correctedName" placeholder="Nome corrigido (se aplicável)" /><input name="retentionUntil" type="datetime-local" /><textarea name="reason" placeholder="Justificativa obrigatória" required rows={2}/><label><input name="identityVerified" type="checkbox"/> Identidade verificada para ação material</label><button type="submit">Executar decisão</button></form> : null}</div></article>;
        })}
        {!requests?.length ? <p className={styles.empty}>Nenhuma solicitação.</p> : null}
      </div></section></main>
      <aside><form action={createPrivacyRequestAction} className={styles.formCard}><h2>Nova solicitação</h2><label><span>Contato</span><select name="contactId"><option value="">Selecione</option>{contacts?.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></label><label><span>Tipo</span><select name="requestType"><option value="access">Acesso</option><option value="export">Exportação</option><option value="correction">Correção</option><option value="restriction">Restrição</option><option value="deletion">Exclusão</option><option value="anonymization">Anonimização</option></select></label><button>Abrir solicitação</button></form></aside>
    </div>
  </div>;
}
