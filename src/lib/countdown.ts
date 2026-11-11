export function countdownTarget(value: string) {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$/.test(value) || value.startsWith("0000")) return null;
  const instant = new Date(value + ":00Z");
  return Number.isFinite(instant.valueOf()) && instant.toISOString().slice(0, 16) === value ? instant : null;
}

const minute = 60_000;

export function countdownRemaining(target: number, now: number) {
  const remaining = target - now;
  if (remaining <= 0) return { label: "Countdown finished.", nextUpdate: null };

  const minutes = Math.ceil(remaining / minute);
  const units = [[Math.floor(minutes / 1440), "day"], [Math.floor(minutes / 60) % 24, "hour"], [minutes % 60, "minute"]] as const;
  const label = units.filter(([count]) => count > 0)
    .map(([count, unit]) => count + " " + unit + (count === 1 ? "" : "s")).join(", ") + " remaining";
  return { label, nextUpdate: remaining % minute || minute };
}

export function countdownDate(instant: Date) {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC", dateStyle: "long", timeStyle: "short", hourCycle: "h23",
  }).format(instant);
  return formatted + " UTC";
}
