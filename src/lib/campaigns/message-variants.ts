import type { CampaignCsvFields } from "./csv";

export type CampaignMessageVariant = {
  id: "investment" | "housing" | "budget";
  label: string;
  template: string;
};

export const DEFAULT_CAMPAIGN_VARIANTS: CampaignMessageVariant[] = [
  {
    id: "investment",
    label: "Retomar interesse",
    template: "Olá {{first_name}}, tudo bem? Queria retomar seu interesse em um studio para {{objetivo}}. Ainda faz sentido eu separar algumas opções considerando {{orcamento}}?",
  },
  {
    id: "housing",
    label: "Pergunta aberta",
    template: "Oi {{first_name}}, tudo certo? Lembrei da sua busca por studio. Seu objetivo continua sendo {{objetivo}}? Se sim, posso te mostrar alternativas dentro de {{orcamento}}.",
  },
  {
    id: "budget",
    label: "Próximo passo",
    template: "Olá {{first_name}}! Posso te ajudar a voltar a olhar studios? {{historico}} Se fizer sentido, filtro opções para {{objetivo}}, pensando em {{orcamento}}.",
  },
];

function clean(value: string | undefined) {
  return value?.trim().replace(/_/g, " ").replace(/\s+/g, " ") ?? "";
}

function objectiveValue(fields: CampaignCsvFields) {
  const value = clean(fields.principal_objetivo || fields.objetivo_studio);
  const normalized = value.toLocaleLowerCase("pt-BR");
  if (normalized.includes("rentabilizar")) return "rentabilizar com aluguel";
  if (normalized.includes("utilizacao propria") || normalized.includes("utilização própria")) return "morar";
  return value || "investir ou morar";
}

function budgetValue(fields: CampaignCsvFields) {
  const entry = clean(fields.limite_entrada);
  const installment = clean(fields.limite_parcela);
  if (entry && installment) return `uma entrada de ${entry} e uma parcela de ${installment}`;
  if (entry) return `uma entrada de ${entry}`;
  if (installment) return `uma parcela de ${installment}`;
  return "as condições que você tinha em mente";
}

function historyValue(fields: CampaignCsvFields) {
  const value = clean(fields.ja_investiu_em_studio).toLocaleLowerCase("pt-BR");
  if (value === "sim" || value.startsWith("s")) return "Você já investiu em studio antes; posso comparar novas possibilidades.";
  if (value === "não" || value === "nao" || value.startsWith("n")) return "Como ainda não investiu em studio, posso começar pelas opções mais alinhadas ao seu perfil.";
  return "Posso partir do ponto em que você parou e te mostrar o que faz sentido hoje.";
}

export function campaignMessageFields(fields: CampaignCsvFields) {
  return {
    ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, clean(value)])),
    objetivo: objectiveValue(fields),
    entrada: clean(fields.limite_entrada),
    parcela: clean(fields.limite_parcela),
    orcamento: budgetValue(fields),
    historico: historyValue(fields),
  };
}

export function renderCampaignOpening(
  template: string,
  firstName: string,
  fields: CampaignCsvFields = {},
) {
  const values = { ...campaignMessageFields(fields), first_name: clean(firstName), name: clean(firstName), nome: clean(firstName) };
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => values[key as keyof typeof values] ?? "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
