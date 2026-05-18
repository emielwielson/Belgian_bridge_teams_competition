const BRUSSELS = "Europe/Brussels";

export function formatBrussels(isoUtc: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BRUSSELS,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoUtc));
}

/** Date and time parts for standings round column headers (compact DD/MM/YY). */
export function formatBrusselsRoundHeader(isoUtc: string): {
  date: string;
  time: string;
} {
  const d = new Date(isoUtc);
  return {
    date: new Intl.DateTimeFormat("en-GB", {
      timeZone: BRUSSELS,
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }).format(d),
    time: new Intl.DateTimeFormat("en-GB", {
      timeZone: BRUSSELS,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d),
  };
}

/** Parse local Brussels datetime string to UTC ISO (YYYY-MM-DDTHH:mm). */
export function parseBrusselsToUtc(localValue: string): string {
  const [datePart, timePart = "00:00"] = localValue.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);

  const probe = new Date(
    Date.UTC(y, m - 1, d, hh, mm, 0),
  );
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BRUSSELS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(probe);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  const brusselsAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
  );
  const offsetMs = brusselsAsUtc - probe.getTime();
  return new Date(probe.getTime() - offsetMs).toISOString();
}

export function toDatetimeLocalValue(isoUtc: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRUSSELS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(isoUtc));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
