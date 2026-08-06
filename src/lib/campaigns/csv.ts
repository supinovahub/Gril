import { normalizePhoneToE164 } from "../crm/phone";

const PHONE_WORDS = new Set(["telefone", "phone", "celular", "whatsapp", "fone", "mobile", "numero"]);
const NAME_WORDS = new Set(["nome", "name", "cliente", "lead", "contato"]);

export function decodeCsvBytes(bytes: Uint8Array) {
  let decoded: string;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    decoded = new TextDecoder("utf-16le").decode(bytes);
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    decoded = new TextDecoder("utf-16be").decode(bytes);
  } else {
    try {
      decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      decoded = new TextDecoder("windows-1252").decode(bytes);
    }
  }
  return decoded.replace(/^\uFEFF/, "");
}

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

export function campaignCsvRow(values: string[], nameIndex: number, phoneIndex: number) {
  const name = (values[nameIndex] ?? "").trim();
  const rawPhone = (values[phoneIndex] ?? "").trim();
  return { name, phone: normalizePhoneToE164(rawPhone) ?? rawPhone };
}
