import { normalizePhoneToE164 } from "../crm/phone";

const PHONE_WORDS = new Set(["telefone", "phone", "celular", "whatsapp", "fone", "mobile", "numero"]);
const NAME_WORDS = new Set(["nome", "name", "cliente", "lead", "contato"]);

export type CampaignCsvFields = Record<string, string>;

export type CampaignCsvRow = {
  name: string;
  phone: string;
  fields: CampaignCsvFields;
};

export function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"' && quoted) { current += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if ((char === "," || char === ";") && !quoted) { result.push(current.trim()); current = ""; }
    else current += char;
  }
  result.push(current.trim());
  return result;
}

export function normalizeCsvHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeCampaignFieldKey(value: string) {
  const normalized = normalizeCsvHeader(value);
  if (normalized.includes("voce ja investiu") && normalized.includes("studio")) {
    return "ja_investiu_em_studio";
  }
  if (normalized.includes("valor de entrada")) return "limite_entrada";
  if (normalized.includes("valor de parcela")) return "limite_parcela";
  if (normalized.includes("principal objetivo") && normalized.includes("studio")) {
    return "objetivo_studio";
  }
  if (normalized === "principal objetivo") return "principal_objetivo";
  return normalized.replace(/\s+/g, "_") || "campo";
}

function isPhoneHeader(value: string) {
  const words = normalizeCsvHeader(value).split(" ").filter(Boolean);
  return words.some((word) => PHONE_WORDS.has(word));
}

function isNameHeader(value: string) {
  const words = normalizeCsvHeader(value).split(" ").filter(Boolean);
  return !words.some((word) => PHONE_WORDS.has(word))
    && words.some((word) => NAME_WORDS.has(word));
}

function resolveIndex(header: string[], requested: string, kind: "name" | "phone") {
  const normalizedHeader = header.map(normalizeCsvHeader);
  const normalizedRequested = normalizeCsvHeader(requested);
  if (normalizedRequested) {
    const exact = normalizedHeader.indexOf(normalizedRequested);
    if (exact >= 0) return exact;
  }
  const semanticRequest = kind === "name" ? isNameHeader(requested) : isPhoneHeader(requested);
  if (!normalizedRequested || semanticRequest) {
    return header.findIndex(kind === "name" ? isNameHeader : isPhoneHeader);
  }
  return -1;
}

export function resolveCampaignCsvColumns(header: string[], requestedName: string, requestedPhone: string) {
  const nameIndex = resolveIndex(header, requestedName, "name");
  const phoneIndex = resolveIndex(header, requestedPhone, "phone");
  return {
    nameIndex,
    phoneIndex,
    valid: nameIndex >= 0 && phoneIndex >= 0 && nameIndex !== phoneIndex,
  };
}

export function campaignCsvRow(
  values: string[],
  header: string[],
  nameIndex: number,
  phoneIndex: number,
): CampaignCsvRow {
  const name = (values[nameIndex] ?? "").trim();
  const rawPhone = (values[phoneIndex] ?? "").trim();
  const fields: CampaignCsvFields = {};
  header.forEach((column, index) => {
    const keyBase = normalizeCampaignFieldKey(column);
    let key = keyBase;
    let suffix = 2;
    while (key in fields) {
      key = `${keyBase}_${suffix}`;
      suffix += 1;
    }
    const value = (values[index] ?? "").trim();
    if (value) fields[key] = value;
  });
  return { name, phone: normalizePhoneToE164(rawPhone) ?? rawPhone, fields };
}

export function decodeCsvBytes(bytes: Uint8Array) {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes).replace(/^\uFEFF/, "");
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes).replace(/^\uFEFF/, "");
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(bytes).replace(/^\uFEFF/, "");
  }
}
