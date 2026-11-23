"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { widgetVisitorToken } from "@/lib/widget-visitor";

const resultSchema = z.strictObject({
  pollId: z.uuid(), total: z.number().int().nonnegative(), counts: z.record(z.string(), z.number().int().nonnegative()),
});

export function PollWidget({ username, pollId, question, options, open, closesAt, showResultsBeforeVote }: {
  username: string; pollId: string; question: string; options: { id: string; label: string }[];
  open: boolean; closesAt: string | null; showResultsBeforeVote: boolean;
}) {
  const [selected, setSelected] = useState("");
  const [voted, setVoted] = useState(false);
  const [results, setResults] = useState<z.infer<typeof resultSchema> | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const isClosed = !open || Boolean(closesAt && Date.parse(closesAt) <= Date.now());
  const showResults = showResultsBeforeVote || voted || isClosed;

  useEffect(() => {
    const controller = new AbortController();
    let hadVoted = false;
    try { hadVoted = window.localStorage.getItem("snoozer-poll-vote:" + pollId) === "yes"; } catch { /* Storage is optional. */ }
    if (hadVoted) setVoted(true);
    async function loadResults() {
      try {
        const url = "/api/v1/widgets/poll?username=" + encodeURIComponent(username) + "&pollId=" + encodeURIComponent(pollId);
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Poll results unavailable.");
        const parsed = resultSchema.safeParse(await response.json());
        if (!parsed.success || parsed.data.pollId !== pollId) throw new Error("Poll results invalid.");
        if (!controller.signal.aborted) setResults(parsed.data);
      } catch {
        if (!controller.signal.aborted) setNotice("Poll results are temporarily unavailable.");
      }
    }
    if (showResultsBeforeVote || hadVoted || isClosed) void loadResults();
    return () => controller.abort();
  }, [username, pollId, showResultsBeforeVote, isClosed]);

  async function vote(optionId: string) {
    if (busy || voted || isClosed) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/v1/widgets/poll", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pollId, optionId, visitorToken: widgetVisitorToken() }),
      });
      const payload = await response.json();
      if (response.status === 409 && payload.results) {
        setVoted(true);
        setNotice("A vote has already been recorded from this browser for this poll.");
        try { window.localStorage.setItem("snoozer-poll-vote:" + pollId, "yes"); } catch { /* Optional. */ }
        const parsed = resultSchema.safeParse(payload.results);
        if (parsed.success) setResults(parsed.data);
        return;
      }
      if (!response.ok) throw new Error(response.status === 410 ? "This poll has closed." : "Your vote could not be recorded.");
      const parsed = resultSchema.safeParse(payload);
      if (!parsed.success || parsed.data.pollId !== pollId) throw new Error("Poll response invalid.");
      setResults(parsed.data);
      setVoted(true);
      try { window.localStorage.setItem("snoozer-poll-vote:" + pollId, "yes"); } catch { /* Optional. */ }
      setNotice("Your vote has been recorded.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Your vote could not be recorded.");
    } finally { setBusy(false); }
  }

  return <section className="profile-widget profile-poll" aria-labelledby={"poll-" + pollId}>
    <h2 id={"poll-" + pollId}>{question}</h2>
    {isClosed && <p className="muted">Voting is closed.</p>}
    {!isClosed && !voted && !showResults && <div className="poll-options">
      {options.map((option) => <button type="button" className={"button small" + (selected === option.id ? " is-selected" : "")}
        key={option.id} aria-pressed={selected === option.id} onClick={() => setSelected(option.id)}>{option.label}</button>)}
      <button className="button small primary" type="button" disabled={!selected || busy} onClick={() => void vote(selected)}>{busy ? "Submitting…" : "Vote"}</button>
    </div>}
    {showResults && <div className="poll-results" aria-live="polite">
      {options.map((option) => {
        const count = results?.counts[option.id] ?? 0;
        const percentage = results?.total ? Math.round(count / results.total * 100) : 0;
        return <div className="poll-result" key={option.id}>
          <div className="poll-result-label"><strong>{option.label}</strong><span>{count} · {percentage}%</span></div>
          <div className="poll-result-track" role="progressbar" aria-label={option.label + " votes"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}>
            <span style={{ width: percentage + "%" }} />
          </div>
        </div>;
      })}
      <p className="muted">{results ? results.total + " votes" : "Loading results…"}</p>
    </div>}
    {notice && <p className="muted" role="status">{notice}</p>}
  </section>;
}
