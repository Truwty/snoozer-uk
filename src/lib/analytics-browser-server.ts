import { createHash } from "node:crypto";

export function browserKey(event: { username: string; version?: number; browser?: string; browserDay?: string }, now = new Date()) {
  if ((event.version !== 3 && event.version !== 4) || !event.browser || event.browserDay !== now.toISOString().slice(0, 10)) return null;
  // Raw browser codes never reach PostgreSQL. Reuse across profiles/days cannot link rows.
  return createHash("sha256").update(event.username + "\0" + event.browserDay + "\0" + event.browser).digest("hex");
}
