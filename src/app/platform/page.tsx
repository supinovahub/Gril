import { redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

export default async function PlatformPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login?next=/platform");
  const { data: organizations, error } = await supabase.rpc("platform_organization_metrics");
  if (error) redirect("/app");
  return <main style={{maxWidth:1100,margin:'0 auto',padding:'40px 24px',display:'grid',gap:24}}>
    <header><p style={{textTransform:'uppercase',letterSpacing:'.12em',fontSize:11}}>Plataforma · suporte</p><h1>Saúde agregada das organizações</h1><p>Esta área não exibe conteúdo de leads. Acesso ao tenant exige concessão contratual registrada no banco privado.</p><Link href="/app">Voltar ao produto</Link></header>
    <table style={{width:'100%',borderCollapse:'collapse',background:'white'}}><thead><tr><th>Organização</th><th>Status</th><th>Membros</th><th>Oportunidades abertas</th><th>WhatsApps ativos</th><th>Última atividade</th></tr></thead><tbody>{organizations?.map((item)=><tr key={item.org_id}><td>{item.organization_name}</td><td>{item.status}</td><td>{item.active_members}</td><td>{item.open_opportunities}</td><td>{item.active_connections}</td><td>{item.last_activity_at?new Date(item.last_activity_at).toLocaleString('pt-BR'):'—'}</td></tr>)}</tbody></table>
  </main>;
}
