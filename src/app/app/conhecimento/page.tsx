import { BookOpenCheck, Building2, CircleAlert, FileQuestion } from "lucide-react";

import { requireActiveViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createFaqAction, createProjectAction, createProjectFactAction, createProjectMediaAction } from "./actions";
import styles from "./knowledge.module.css";

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const viewer = await requireActiveViewer();
  const feedback = await searchParams;
  const supabase = await createClient();
  const [{ data: projects }, { data: faqs }, { data: definitions }] = await Promise.all([
    supabase.from("projects").select("*,project_facts(id,code,value_text,unit,source_name,valid_until,active),project_media(id,media_type,title,external_url,storage_path,active)").eq("org_id", viewer.organization!.id).order("created_at", { ascending: false }),
    supabase.from("faq_entries").select("id,canonical_question,status,scope,faq_versions(base_answer,response_mode,version,status)").eq("org_id", viewer.organization!.id).order("created_at", { ascending: false }),
    supabase.from("qualification_definitions").select("id,code,name,answer_type,required,validity_days,suggested_order").eq("org_id", viewer.organization!.id).eq("active", true).order("suggested_order"),
  ]);
  const activeProjects = projects?.filter((item) => item.status === "active").length ?? 0;
  const publishedFaqs = faqs?.filter((item) => item.status === "published").length ?? 0;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}><div><p className={styles.eyebrow}>Conhecimento aprovado</p><h1>Empreendimentos e FAQ</h1><p>Fatos estruturados têm precedência sobre texto livre e sempre carregam fonte e validade.</p></div></header>
      {feedback.erro ? <p className={styles.errorBanner}>{feedback.erro}</p> : null}
      {feedback.sucesso ? <p className={styles.successBanner}>Cadastro salvo.</p> : null}
      <section className={styles.readiness}>
        <div><Building2 size={18} /><span><small>Empreendimentos ativos</small><strong>{activeProjects} / 5 recomendados</strong></span></div>
        <div><FileQuestion size={18} /><span><small>FAQs globais</small><strong>{publishedFaqs} / 10 recomendadas</strong></span></div>
        <div><BookOpenCheck size={18} /><span><small>Objetivos de qualificação</small><strong>{definitions?.length ?? 0} publicados</strong></span></div>
      </section>

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.panel}><div className={styles.panelHeader}><h2>Empreendimentos</h2><span>Preço + entrada são critérios mínimos</span></div><div className={styles.catalog}>{projects?.map((project) => <article key={project.id}><span className={styles.projectIcon}><Building2 size={18} /></span><span><strong>{project.name}</strong><small>{project.neighborhood || project.region} · {project.delivery_type}</small><small>{project.project_facts?.filter((fact)=>fact.active).length ?? 0} fatos · {project.project_media?.filter((media)=>media.active).length ?? 0} mídias</small></span><span><strong>{project.min_price?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? "Preço pendente"}</strong><small>Entrada {project.min_down_payment?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? "pendente"}</small></span><span className={styles.status}>{project.status}</span></article>)}{!projects?.length ? <p className={styles.empty}>Nenhum empreendimento cadastrado.</p> : null}</div></section>
          <section className={styles.panel}><div className={styles.panelHeader}><h2>FAQs globais</h2><span>Comunicação, não valores</span></div><div className={styles.faqList}>{faqs?.map((faq) => { const versions = (faq.faq_versions ?? []) as Array<{ base_answer:string; response_mode:string; version:number; status:string }>; const version=versions.find((item)=>item.status==='published'); return <article key={faq.id}><strong>{faq.canonical_question}</strong><p>{version?.base_answer ?? "Sem versão publicada"}</p><small>{version?.response_mode} · v{version?.version}</small></article>; })}{!faqs?.length ? <p className={styles.empty}>Cadastre a base mínima antes do piloto.</p> : null}</div></section>
          <section className={styles.panel}><div className={styles.panelHeader}><h2>Qualificação publicada</h2><span>Validade e fonte por resposta</span></div><ol className={styles.definitionList}>{definitions?.map((definition) => <li key={definition.id}><span>{definition.suggested_order}</span><strong>{definition.name}</strong><small>{definition.answer_type} · {definition.required ? "obrigatório" : "complementar"} · {definition.validity_days ? `${definition.validity_days} dias` : "recoletar"}</small></li>)}</ol></section>
        </div>
        <aside className={styles.forms}>
          <form action={createProjectAction} className={styles.formCard}><div><p className={styles.eyebrow}>Cadastro resumido</p><h2>Novo empreendimento</h2></div><label><span>Nome</span><input name="name" required /></label><div className={styles.two}><label><span>Região</span><input name="region" required /></label><label><span>Bairro</span><input name="neighborhood" /></label></div><label><span>Resumo</span><textarea name="summary" required rows={3} /></label><label><span>Entrega</span><select name="deliveryType"><option value="ready">Pronto</option><option value="under_construction">Em obra</option><option value="launch">Lançamento</option><option value="mixed">Misto</option></select></label><div className={styles.two}><label><span>Preço mínimo</span><input min="0" name="minPrice" required type="number" /></label><label><span>Preço máximo</span><input min="0" name="maxPrice" required type="number" /></label></div><label><span>Entrada mínima</span><input min="0" name="minDownPayment" required type="number" /></label><label><span>Fonte</span><input name="sourceName" required /></label><label><span>Válido até</span><input name="validUntil" required type="date" /></label><label><span>Caminho da capa no Storage</span><input name="coverStoragePath" required /></label><label className={styles.check}><input name="activate" type="checkbox" /> Ativar e permitir recomendação</label><button type="submit">Salvar empreendimento</button></form>
          <form action={createFaqAction} className={styles.formCard}><div><p className={styles.eyebrow}>Conhecimento global</p><h2>Nova FAQ</h2></div><label><span>Pergunta canônica</span><input name="question" required /></label><label><span>Resposta base</span><textarea name="answer" required rows={4} /></label><label><span>Modo</span><select name="responseMode"><option value="direct">Resposta direta</option><option value="brief_then_call">Breve + call</option><option value="silent_escalation">Escalada silenciosa</option></select></label><label><span>Fonte</span><input name="sourceName" required /></label><button type="submit">Publicar FAQ v1</button></form>
          <form action={createProjectFactAction} className={styles.formCard}><div><p className={styles.eyebrow}>Fonte e validade</p><h2>Novo fato aprovado</h2></div><label><span>Empreendimento</span><select name="projectId" required><option value="">Selecione</option>{projects?.map((project)=><option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label><span>Código</span><input name="code" placeholder="area_privativa" required /></label><label><span>Valor</span><textarea name="valueText" required rows={2} /></label><label><span>Unidade</span><input name="unit" placeholder="m², vagas, torres..." /></label><label><span>Fonte</span><input name="sourceName" required /></label><div className={styles.two}><label><span>Referência</span><input defaultValue={new Date().toISOString().slice(0,10)} name="referenceDate" type="date" required /></label><label><span>Válido até</span><input name="validUntil" type="date" required /></label></div><button>Salvar fato</button></form>
          <form action={createProjectMediaAction} className={styles.formCard}><div><p className={styles.eyebrow}>Material aprovado</p><h2>Vincular mídia</h2></div><label><span>Empreendimento</span><select name="projectId" required><option value="">Selecione</option>{projects?.map((project)=><option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label><span>Tipo</span><select name="mediaType"><option value="cover">Capa</option><option value="image">Imagem</option><option value="pdf">PDF</option><option value="official_link">Link oficial</option></select></label><label><span>Título</span><input name="title" required /></label><label><span>URL HTTPS aprovada</span><input name="externalUrl" type="url" required /></label><label><span>Ordem</span><input defaultValue="0" min="0" name="sortOrder" type="number" /></label><button>Vincular mídia</button></form>
          {(activeProjects < 5 || publishedFaqs < 10) ? <p className={styles.warning}><CircleAlert size={15} /> A base recomendada ainda está incompleta. É advertência de prontidão, não bloqueio técnico.</p> : null}
        </aside>
      </div>
    </div>
  );
}

