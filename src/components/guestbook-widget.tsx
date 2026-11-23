"use client";

import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { widgetVisitorToken } from "@/lib/widget-visitor";

const entrySchema = z.array(z.strictObject({
  id: z.uuid(), displayName: z.string(), message: z.string(), createdAt: z.iso.datetime({ offset: true }),
}));

export function GuestbookWidget({ username, heading, description, maxEntries, submissionsOpen }: {
  username: string; heading: string; description: string; maxEntries: number; submissionsOpen: boolean;
}) {
  const [entries, setEntries] = useState<z.infer<typeof entrySchema>>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/v1/widgets/guestbook?username=" + encodeURIComponent(username), {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("Guestbook unavailable.");
        const parsed = entrySchema.safeParse((await response.json()).entries);
        if (!parsed.success) throw new Error("Guestbook response invalid.");
        if (!controller.signal.aborted) setEntries(parsed.data);
      } catch {
        if (!controller.signal.aborted) setNotice("Guestbook messages are temporarily unavailable.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [username]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setNotice("");
    try {
      const response = await fetch("/api/v1/widgets/guestbook", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, displayName: name, message, visitorToken: widgetVisitorToken() }),
      });
      if (response.status === 429) throw new Error("You have reached the Guestbook submission limit. Try again later.");
      if (response.status === 404) throw new Error("This Guestbook is no longer accepting messages.");
      if (!response.ok) throw new Error("Your message could not be submitted. Try again.");
      setName("");
      setMessage("");
      setNotice("Message submitted. It will appear if the creator approves it.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Your message could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="profile-widget profile-guestbook" aria-labelledby={"guestbook-" + username}>
    <h2 id={"guestbook-" + username}>{heading}</h2>
    {description && <p className="profile-widget-description">{description}</p>}
    {loading ? <p className="muted" role="status">Loading messages…</p> : entries.length === 0
      ? <p className="muted">No approved messages yet.</p>
      : <ol className="guestbook-entries">{entries.slice(0, maxEntries).map((entry) => <li key={entry.id}>
        <p>{entry.message}</p><footer><strong>{entry.displayName}</strong><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleDateString("en-GB")}</time></footer>
      </li>)}</ol>}
    {submissionsOpen ? <form className="guestbook-form stack" onSubmit={submit}>
      <label>Your name<input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Message<textarea required minLength={3} maxLength={500} rows={3} value={message} onChange={(event) => setMessage(event.target.value)} /></label>
      <button className="button small" type="submit" disabled={submitting}>{submitting ? "Submitting…" : "Sign guestbook"}</button>
    </form> : <p className="muted">The creator has closed new Guestbook submissions.</p>}
    {notice && <p className="muted" role="status" aria-live="polite">{notice}</p>}
  </section>;
}
