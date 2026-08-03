const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function partsAt(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

function offsetAt(date: Date, timeZone: string) {
  const parts = partsAt(date, timeZone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - date.getTime();
}

export function zonedLocalDateTimeToIso(value: string, timeZone: string) {
  const match = localDateTimePattern.exec(value);
  if (!match) throw new Error("invalid_local_datetime");
  const [, year, month, day, hour, minute, second = "00"] = match;
  const wallClock = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  const firstGuess = new Date(wallClock);
  let instant = new Date(wallClock - offsetAt(firstGuess, timeZone));
  instant = new Date(wallClock - offsetAt(instant, timeZone));
  const resolved = partsAt(instant, timeZone);
  if (resolved.year !== Number(year) || resolved.month !== Number(month) || resolved.day !== Number(day)
      || resolved.hour !== Number(hour) || resolved.minute !== Number(minute)) {
    throw new Error("nonexistent_or_ambiguous_local_datetime");
  }
  return instant.toISOString();
}
