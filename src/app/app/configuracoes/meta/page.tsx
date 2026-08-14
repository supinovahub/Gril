import { Cloud, MessageSquareMore } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import styles from "../../operations.module.css";

export default async function MetaSettingsPage() {
  const viewer = await requireActiveViewer();
  const supabase = await createClient();
  const { data: connections, error } = await supabase
    .from("whatsapp_connections")
    .select("id,name,phone_e164,status,inbound_enabled")
    .eq("org_id", viewer.organization!.id)
    .eq("provider", "meta_cloud")
    .order("created_at", { ascending: false });

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Integrações"
        title="Meta Cloud"
        description="Acompanhe os números oficiais conectados. O cadastro de formulários e pré-leads não faz mais parte da interface operacional."
      >
        <ButtonLink href="/app/configuracoes/whatsapp" variant="secondary">Gerenciar números</ButtonLink>
      </PageHeader>
      {error ? <p className={styles.error}>Não foi possível carregar as conexões Meta.</p> : null}
      <section className={styles.panel}>
        <div className={styles.panelHeader}><h2>Números conectados</h2><Cloud size={17} /></div>
        <div className={styles.list}>
          {connections?.map((connection) => (
            <article className={styles.item} key={connection.id}>
              <span><strong>{connection.name}</strong><small>{connection.phone_e164 ?? "Número protegido"}</small></span>
              <StatusBadge tone={connection.status === "active" && connection.inbound_enabled ? "positive" : "warning"}>
                {connection.status === "active" && connection.inbound_enabled ? "Recebendo mensagens" : "Requer atenção"}
              </StatusBadge>
            </article>
          ))}
          {!connections?.length ? <p className={styles.empty}><MessageSquareMore size={18} /> Nenhum número Meta Cloud conectado.</p> : null}
        </div>
      </section>
    </div>
  );
}
