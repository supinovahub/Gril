"use client";

import { useState } from "react";

import { createProjectAction } from "./actions";
import styles from "./knowledge.module.css";

const moneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return moneyFormatter.format(Number(digits) / 100);
}

export function ProjectCreateForm() {
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minDownPayment, setMinDownPayment] = useState("");

  return <form action={createProjectAction} className={styles.formCard}>
    <div><p className={styles.eyebrow}>Cadastro resumido</p><h2>Novo empreendimento</h2></div>
    <p className={styles.helper}>Primeiro salve o rascunho. Depois adicione a foto principal e ative para o Pedro recomendar.</p>
    <label><span>Nome</span><input name="name" required /></label>
    <div className={styles.two}><label><span>Região ou cidade</span><input name="region" required /></label><label><span>Bairro (opcional)</span><input name="neighborhood" /></label></div>
    <label><span>Resumo</span><textarea aria-describedby="project-summary-help" minLength={20} name="summary" required rows={3} /><small id="project-summary-help">Use pelo menos 20 caracteres com a proposta principal do empreendimento.</small></label>
    <label><span>Entrega</span><select name="deliveryType"><option value="ready">Pronto</option><option value="under_construction">Em obra</option><option value="launch">Lançamento</option><option value="mixed">Misto</option></select></label>
    <div className={styles.two}><label><span>Preço mínimo</span><input inputMode="numeric" name="minPrice" onChange={(event) => setMinPrice(formatCurrencyInput(event.target.value))} placeholder="R$ 0,00" required value={minPrice} /></label><label><span>Preço máximo</span><input inputMode="numeric" name="maxPrice" onChange={(event) => setMaxPrice(formatCurrencyInput(event.target.value))} placeholder="R$ 0,00" required value={maxPrice} /></label></div>
    <label><span>Entrada mínima</span><input inputMode="numeric" name="minDownPayment" onChange={(event) => setMinDownPayment(formatCurrencyInput(event.target.value))} placeholder="R$ 0,00" required value={minDownPayment} /></label>
    <label><span>Fonte dos dados comerciais</span><input aria-describedby="project-source-help" name="sourceName" placeholder="Ex.: tabela comercial da incorporadora — agosto/2026" required /><small id="project-source-help">Informe de onde vieram preços, condições e demais informações que o Pedro poderá usar.</small></label>
    <label><span>Dados válidos até</span><input name="validUntil" required type="date" /></label>
    <button type="submit">Salvar rascunho</button>
  </form>;
}
