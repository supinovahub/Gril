export const DEFAULT_OPERATION_TIMEZONE = "America/Sao_Paulo";

export function formatOperationDateTime(
  value: string | Date,
  timeZone: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" },
) {
  return new Intl.DateTimeFormat("pt-BR", {
    ...options,
    timeZone: timeZone || DEFAULT_OPERATION_TIMEZONE,
  }).format(new Date(value));
}

