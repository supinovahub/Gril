import { FlaskConical } from "lucide-react";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import styles from "../../operations.module.css";
import { createExperimentAction, transitionExperimentAction } from "./actions";

export default async function ExperimentsPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const viewer = await requireActiveViewer(); const feedback = await searchParams; const supabase = await createClient();
  const [{ data: experiments }, { data: personaVersions }, { data: ruleVersions }, { data: events }] = await Promise.all([
    supabase.from("experiments").select("*,experiment_variants(*)").eq("org_id", viewer.organization!.id).order("created_at", { ascending: false }),
    supabase.from("persona_versions").select("id,version,personas(name)").eq("org_id", viewer.organization!.id).eq("status", "published"),
    supabase.from("rule_versions").select("id,version").eq("org_id", viewer.organization!.id).eq("status", "published"),
    supabase.from("experiment_events").select("experiment_id,variant_id,event_type,severity").eq("org_id", viewer.organization!.id),
  ]);
  const operation = viewer.operations.find((item)=>item.is_default) ?? viewer.operations[0];
  return <div className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>Alocação estável</p><h1>Experimentos A/B</h1><p>A variante fica presa ao lead; somente o dono inicia ou encerra, e gestores podem pausar por segurança.</p></div><FlaskConical/></header>
    {feedback.erro ? <p className={styles.error}>{feedback.erro}</p> : null}{feedback.sucesso ? <p className={styles.success}>Alteração registrada.</p> : null}
    <div className={styles.layout}><main><section className={styles.panel}><div className={styles.panelHeader}><h2>Experimentos</h2><span>{experiments?.length ?? 0}</span></div><div className={styles.list}>
      {experiments?.map((experiment)=>{
        const experimentEvents=events?.filter((item)=>item.experiment_id===experiment.id) ?? []; const variants=experiment.experiment_variants ?? [];
        return <article className={styles.item} key={experiment.id}><span><strong>{experiment.name}</strong><small>{experiment.scope} · {experiment.status}</small><small>{experimentEvents.filter((item)=>item.event_type.includes('call')).length} calls · {experimentEvents.filter((item)=>item.event_type.includes('qualified')).length} qualificações · {experimentEvents.filter((item)=>item.severity==='critical').length} erros críticos</small></span><form action={transitionExperimentAction}><input name="experimentId" type="hidden" value={experiment.id}/><select name="winnerVariantId"><option value="">Sem vencedor</option>{variants.map((variant)=><option key={variant.id} value={variant.id}>{variant.name}</option>)}</select><input name="reason" placeholder="Motivo"/><div className={styles.actions}>{experiment.status==='draft' ? <button name="action" value="start">Iniciar</button> : null}{experiment.status==='running' ? <button name="action" value="pause">Pausar</button> : null}{experiment.status==='paused' ? <button name="action" value="resume">Retomar</button> : null}{['running','paused'].includes(experiment.status) ? <><button name="action" value="complete">Encerrar</button><button name="action" value="promote_winner">Promover vencedor</button></> : null}</div></form></article>;
      })}{!experiments?.length ? <p className={styles.empty}>Nenhum experimento criado.</p> : null}</div></section></main>
      <aside><form action={createExperimentAction} className={styles.formCard}><h2>Novo A/B 50/50</h2><input name="operationId" type="hidden" value={operation?.id}/><label><span>Nome</span><input name="name" required/></label><label><span>Escopo</span><select name="scope"><option value="eligible_inbound">Inbound elegível</option><option value="campaign">Campanha</option></select></label><label><span>Persona A</span><select name="personaA" required>{personaVersions?.map((item)=><option key={item.id} value={item.id}>{(item.personas as {name:string}|null)?.name} v{item.version}</option>)}</select></label><label><span>Persona B</span><select name="personaB" required>{personaVersions?.map((item)=><option key={item.id} value={item.id}>{(item.personas as {name:string}|null)?.name} v{item.version}</option>)}</select></label><label><span>Regras publicadas</span><select name="ruleVersionId" required>{ruleVersions?.map((item)=><option key={item.id} value={item.id}>v{item.version}</option>)}</select></label><button>Criar rascunho</button></form></aside>
    </div>
  </div>;
}
