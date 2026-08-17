import { BookOpenCheck, Building2, CircleAlert, Database, FileImage, FileQuestion, MessageCircleQuestion, Trash2 } from "lucide-react";

import { TypedConfirmationButton } from "@/components/typed-confirmation-button";
import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { changeProjectRecommendationAction, createFaqAction, createProjectFactAction, deleteProjectAction, resolveProjectFactConflictAction } from "./actions";
import { ProjectCreateForm } from "./project-create-form";
import { ProjectEditForm } from "./project-edit-form";
import { ProjectMediaManager } from "./project-media-manager";
import styles from "./knowledge.module.css";

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const viewer = await requireActiveViewer();
  const feedback = await searchParams;
  const supabase = await createClient();
  const [{ data: projects }, { data: faqs }, { data: definitions }, { data: conflicts }] = await Promise.all([
    supabase.from("projects").select("*,project_facts(id,code,value_text,unit,source_name,valid_until,active),project_media(id,media_type,title,external_url,storage_path,active)").eq("org_id", viewer.organization!.id).order("created_at", { ascending: false }),
    supabase.from("faq_entries").select("id,canonical_question,status,scope,faq_versions(base_answer,response_mode,version,status)").eq("org_id", viewer.organization!.id).order("created_at", { ascending: false }),
    supabase.from("qualification_definitions").select("id,code,name,answer_type,required,validity_days,suggested_order").eq("org_id", viewer.organization!.id).eq("active", true).order("suggested_order"),
    supabase.from("project_fact_conflicts").select("id,code,proposed_value_text,proposed_value_number,proposed_source_name,current_snapshot,projects(name)").eq("org_id", viewer.organization!.id).eq("status", "pending").order("created_at"),
  ]);
  const activeProjects = projects?.filter((item) => item.status === "active").length ?? 0;
  const publishedFaqs = faqs?.filter((item) => item.status === "published").length ?? 0;
  const media = (projects ?? []).flatMap((project) => (project.project_media ?? []).map((item) => ({ ...item, project_id: project.id })));

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}><div><p className={styles.eyebrow}>Fontes do Pedro</p><h1>Base de conhecimento</h1><p>Empreendimentos, respostas e critérios comerciais que podem ser usados no atendimento.</p></div></header>
      {feedback.erro ? <p className={styles.errorBanner}>{feedback.erro}</p> : null}
      {feedback.sucesso ? <p className={styles.successBanner}>{({
        "empreendimento-criado-em-rascunho": "Rascunho salvo. Adicione a foto principal e depois ative o empreendimento.",
        "empreendimento-ativado": "Empreendimento ativo e disponível para recomendação.",
        "empreendimento-pausado": "Recomendações pausadas; o cadastro continua salvo.",
        "empreendimento-atualizado": "Empreendimento atualizado.",
        "empreendimento-excluido": "Empreendimento excluído permanentemente.",
        "empreendimento-excluido-limpeza-pendente": "Empreendimento excluído. A limpeza física de um arquivo ficou pendente para o suporte.",
      } as Record<string, string>)[feedback.sucesso] ?? "Cadastro salvo."}</p> : null}
      <section className={styles.readiness}>
        <div><Building2 size={18} /><span><small>Empreendimentos ativos</small><strong>{activeProjects}</strong></span></div>
        <div><FileQuestion size={18} /><span><small>FAQs publicadas</small><strong>{publishedFaqs}</strong></span></div>
        <div><BookOpenCheck size={18} /><span><small>Objetivos de qualificação</small><strong>{definitions?.length ?? 0} publicados</strong></span></div>
      </section>

      <nav aria-label="Áreas da Base de conhecimento" className={styles.knowledgeTabs}>
        <a href="#empreendimentos">Empreendimentos</a>
        <a href="#faqs">FAQs</a>
        <a href="#qualificacao">Qualificação</a>
      </nav>

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.panel} id="empreendimentos">
            <div className={styles.panelHeader}><h2>Empreendimentos</h2><span>Preço + entrada são critérios mínimos</span></div>
            <div className={styles.catalog}>
              {projects?.map((project) => <article key={project.id}>
                <span className={styles.projectIcon}><Building2 size={18} /></span>
                <span><strong>{project.name}</strong><small>{project.neighborhood || project.region} · {project.delivery_type}</small><small>{project.project_facts?.filter((fact)=>fact.active).length ?? 0} fatos · {project.project_media?.filter((media)=>media.active).length ?? 0} mídias</small></span>
                <span><strong>{project.min_price?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? "Preço pendente"}</strong><small>Entrada {project.min_down_payment?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? "pendente"}</small></span>
                <div className={styles.projectState}>
                  <span className={styles.status}>{project.status}</span>
                  <form action={changeProjectRecommendationAction}>
                    <input name="projectId" type="hidden" value={project.id}/>
                    {project.status === "active"
                      ? <button name="action" value="pause">Pausar</button>
                      : <button disabled={!project.cover_storage_path} name="action" title={project.cover_storage_path ? "Ativar para recomendação" : "Adicione a foto principal antes de ativar"} value="activate">Ativar</button>}
                  </form>
                  <form action={deleteProjectAction}>
                    <input name="projectId" type="hidden" value={project.id} />
                    <TypedConfirmationButton
                      className={styles.dangerButton}
                      description="O empreendimento e seus fatos, FAQs e mídias serão excluídos. Se ele já fizer parte de um atendimento, a exclusão será bloqueada para preservar o histórico."
                      title={`Excluir ${project.name}?`}
                    ><Trash2 size={13} /> Excluir</TypedConfirmationButton>
                  </form>
                </div>
                <ProjectEditForm project={{
                  id: project.id,
                  name: project.name,
                  region: project.region,
                  neighborhood: project.neighborhood,
                  summary: project.summary,
                  delivery_type: project.delivery_type,
                  min_price: project.min_price,
                  max_price: project.max_price,
                  min_down_payment: project.min_down_payment,
                  source_name: project.source_name,
                  valid_until: project.valid_until,
                }} />
              </article>)}
              {!projects?.length ? <p className={styles.empty}>Nenhum empreendimento cadastrado.</p> : null}
            </div>
          </section>
          <section className={styles.panel} id="faqs"><div className={styles.panelHeader}><h2>FAQs globais</h2><span>Comunicação, não valores</span></div><div className={styles.faqList}>{faqs?.map((faq) => { const versions = (faq.faq_versions ?? []) as Array<{ base_answer:string; response_mode:string; version:number; status:string }>; const version=versions.find((item)=>item.status==='published'); return <article key={faq.id}><strong>{faq.canonical_question}</strong><p>{version?.base_answer ?? "Sem versão publicada"}</p><small>{version?.response_mode} · v{version?.version}</small></article>; })}{!faqs?.length ? <p className={styles.empty}>Nenhuma FAQ publicada.</p> : null}</div></section>
          <section className={styles.panel} id="qualificacao"><div className={styles.panelHeader}><h2>Qualificação publicada</h2><span>Validade e fonte por resposta</span></div><ol className={styles.definitionList}>{definitions?.map((definition) => <li key={definition.id}><span>{definition.suggested_order}</span><strong>{definition.name}</strong><small>{definition.answer_type} · {definition.required ? "obrigatório" : "complementar"} · {definition.validity_days ? `${definition.validity_days} dias` : "recoletar"}</small></li>)}</ol></section>
          {conflicts?.length ? <section className={styles.panel}><div className={styles.panelHeader}><h2>Conflitos de fatos</h2><span>O valor atual continua no Pedro até decisão</span></div><div className={styles.faqList}>{conflicts.map((conflict)=><article key={conflict.id}><strong>{(conflict.projects as {name:string}|null)?.name} · {conflict.code}</strong><p>Atual: {JSON.stringify(conflict.current_snapshot)}<br/>Proposto: {conflict.proposed_value_text ?? conflict.proposed_value_number} · fonte {conflict.proposed_source_name}</p><form action={resolveProjectFactConflictAction}><input name="conflictId" type="hidden" value={conflict.id}/><textarea name="reason" placeholder="Justificativa" required/><div className={styles.two}><button name="decision" value="accept_new">Aceitar novo</button><button name="decision" value="keep_current">Manter atual</button><button name="decision" value="quarantine_current">Quarentenar atual</button></div></form></article>)}</div></section> : null}
        </div>
        <aside className={styles.forms}>
          <div className={styles.creationRail}><span><strong>Adicionar à base</strong><small>Abra somente o cadastro que precisa fazer agora.</small></span></div>
          <details className={styles.knowledgeCreator} open={!projects?.length}>
            <summary><Building2 aria-hidden="true" size={16}/><span><strong>Novo empreendimento</strong><small>Dados comerciais e recomendação</small></span></summary>
            <div className={styles.creatorBody}><ProjectCreateForm /></div>
          </details>
          <details className={styles.knowledgeCreator}>
            <summary><MessageCircleQuestion aria-hidden="true" size={16}/><span><strong>Nova FAQ</strong><small>Resposta aprovada para o Pedro</small></span></summary>
            <form action={createFaqAction} className={styles.formCard}><div><p className={styles.eyebrow}>Conhecimento global</p><h2>Nova FAQ</h2></div><label><span>Pergunta canônica</span><input name="question" required /></label><label><span>Resposta base</span><textarea name="answer" required rows={4} /></label><label><span>Modo</span><select name="responseMode"><option value="direct">Resposta direta</option><option value="brief_then_call">Breve + call</option><option value="silent_escalation">Escalada silenciosa</option></select></label><label><span>Fonte</span><input name="sourceName" required /></label><button type="submit">Publicar FAQ v1</button></form>
          </details>
          <details className={styles.knowledgeCreator}>
            <summary><Database aria-hidden="true" size={16}/><span><strong>Novo fato</strong><small>Valor, fonte e validade</small></span></summary>
            <form action={createProjectFactAction} className={styles.formCard}><div><p className={styles.eyebrow}>Fonte e validade</p><h2>Novo fato aprovado</h2></div><label><span>Empreendimento</span><select name="projectId" required><option value="">Selecione</option>{projects?.map((project)=><option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label><span>Código</span><input name="code" placeholder="area_privativa" required /></label><label><span>Valor</span><textarea name="valueText" required rows={2} /></label><label><span>Unidade</span><input name="unit" placeholder="m², vagas, torres..." /></label><label><span>Fonte</span><input name="sourceName" required /></label><div className={styles.two}><label><span>Referência</span><input defaultValue={new Date().toISOString().slice(0,10)} name="referenceDate" type="date" required /></label><label><span>Válido até (opcional)</span><input name="validUntil" type="date" /></label></div><button>Salvar fato</button></form>
          </details>
          <details className={styles.knowledgeCreator}>
            <summary><FileImage aria-hidden="true" size={16}/><span><strong>Mídias</strong><small>Fotos, book e materiais</small></span></summary>
            <div className={styles.creatorBody}><ProjectMediaManager projects={(projects ?? []).map(({ id, name })=>({ id, name }))} media={media} /></div>
          </details>
          {(activeProjects < 5 || publishedFaqs < 10) ? <p className={styles.warning}><CircleAlert size={15} /> A base recomendada ainda está incompleta. É advertência de prontidão, não bloqueio técnico.</p> : null}
        </aside>
      </div>
    </div>
  );
}

