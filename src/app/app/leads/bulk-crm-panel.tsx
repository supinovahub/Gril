"use client";

import { useState } from "react";
import { bulkCrmAction, createCrmExportAction } from "./actions";
import styles from "./leads.module.css";

type Contact = { id: string; name: string };
type Option = { id: string; label: string };

export function BulkCrmPanel({ contacts, managers, campaigns }: { contacts: Contact[]; managers: Option[]; campaigns: Option[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState("tag_add");
  return <details className={styles.bulkPanel}>
    <summary>Ações em massa seguras <span>{selected.length} selecionados</span></summary>
    <form action={bulkCrmAction} onSubmit={(event)=>{ if(!window.confirm(`Aplicar ${action} em ${selected.length} leads?`)) event.preventDefault(); }}>
      <input name="confirmed" type="hidden" value="yes"/>
      <div className={styles.bulkContacts}>{contacts.map((contact)=><label key={contact.id}><input checked={selected.includes(contact.id)} name="contactIds" onChange={(event)=>setSelected((current)=>event.target.checked?[...current,contact.id]:current.filter((id)=>id!==contact.id))} type="checkbox" value={contact.id}/>{contact.name}</label>)}</div>
      <div className={styles.bulkControls}><select name="action" onChange={(event)=>setAction(event.target.value)} value={action}><option value="tag_add">Adicionar tag</option><option value="tag_remove">Remover tag</option><option value="campaign_include">Incluir em campanha</option><option value="campaign_exclude">Excluir de campanha</option><option value="assign_manager">Atribuir gestor</option><option value="pause_ai">Pausar Pedro</option><option value="resume_ai">Retomar Pedro</option><option value="correct_source">Corrigir origem</option></select><input name="value" placeholder="Tag ou origem"/><select name="membershipId"><option value="">Gestor</option>{managers.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select><select name="campaignId"><option value="">Campanha</option>{campaigns.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select><button disabled={!selected.length}>Aplicar</button><button disabled={!selected.length} formAction={createCrmExportAction}>Exportar CSV</button></div>
    </form>
  </details>;
}
