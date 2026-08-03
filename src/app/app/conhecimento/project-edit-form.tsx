"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { updateProjectAction } from "./actions";
import styles from "./knowledge.module.css";

const moneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return moneyFormatter.format(Number(digits) / 100);
}

function initialCurrency(value: number | null) {
  return value == null ? "" : moneyFormatter.format(value);
}

type EditableProject = {
  id: string;
  name: string;
  region: string;
  neighborhood: string | null;
  summary: string;
  delivery_type: string;
  min_price: number | null;
  max_price: number | null;
  min_down_payment: number | null;
  source_name: string | null;
  valid_until: string | null;
};

export function ProjectEditForm({ project }: { project: EditableProject }) {
  const [minPrice, setMinPrice] = useState(() => initialCurrency(project.min_price));
  const [maxPrice, setMaxPrice] = useState(() => initialCurrency(project.max_price));
  const [minDownPayment, setMinDownPayment] = useState(() => initialCurrency(project.min_down_payment));

  return <details className={styles.projectEditor}>
    <summary><Pencil size={14} /> Editar</summary>
    <form action={updateProjectAction} className={styles.projectEditForm}>
      <input name="projectId" type="hidden" value={project.id} />
      <label><span>Nome</span><input defaultValue={project.name} name="name" required /></label>
      <div className={styles.two}>
        <label><span>Região ou cidade</span><input defaultValue={project.region} name="region" required /></label>
        <label><span>Bairro (opcional)</span><input defaultValue={project.neighborhood ?? ""} name="neighborhood" /></label>
      </div>
      <label><span>Resumo</span><textarea defaultValue={project.summary} minLength={20} name="summary" required rows={3} /><small>Use pelo menos 20 caracteres.</small></label>
      <label><span>Entrega</span><select defaultValue={project.delivery_type} name="deliveryType"><option value="ready">Pronto</option><option value="under_construction">Em obra</option><option value="launch">Lançamento</option><option value="mixed">Misto</option></select></label>
      <div className={styles.two}>
        <label><span>Preço mínimo</span><input inputMode="numeric" name="minPrice" onChange={(event) => setMinPrice(formatCurrencyInput(event.target.value))} required value={minPrice} /></label>
        <label><span>Preço máximo</span><input inputMode="numeric" name="maxPrice" onChange={(event) => setMaxPrice(formatCurrencyInput(event.target.value))} required value={maxPrice} /></label>
      </div>
      <label><span>Entrada mínima</span><input inputMode="numeric" name="minDownPayment" onChange={(event) => setMinDownPayment(formatCurrencyInput(event.target.value))} required value={minDownPayment} /></label>
      <label><span>Fonte dos dados comerciais</span><input defaultValue={project.source_name ?? ""} name="sourceName" required /><small>Origem dos preços, condições e demais informações usadas pelo Pedro.</small></label>
      <label><span>Dados válidos até</span><input defaultValue={project.valid_until ?? ""} name="validUntil" required type="date" /></label>
      <div className={styles.projectEditFooter}><small>O status atual será preservado.</small><button type="submit">Salvar alterações</button></div>
    </form>
  </details>;
}
