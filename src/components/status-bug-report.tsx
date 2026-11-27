"use client";

import { useState, type FormEvent } from "react";

const categories = [
  { value: "bug", label: "Something is broken" },
  { value: "visual", label: "Visual or layout issue" },
  { value: "account", label: "Account or sign-in issue" },
  { value: "payments", label: "Payment or subscription issue" },
  { value: "other", label: "Something else" },
] as const;

export function StatusBugReport() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const formElement = event.currentTarget;
    setSubmitting(true);
    setError("");
    const form = new FormData(formElement);
    const payload = {
      category: String(form.get("category") ?? "bug"),
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      steps: String(form.get("steps") ?? ""),
      contactEmail: String(form.get("contactEmail") ?? ""),
      pagePath: window.location.pathname,
      website: String(form.get("website") ?? ""),
    };

    try {
      const response = await fetch("/api/status/bugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({})) as { reportId?: string; error?: string };

      if (response.ok && result.reportId) {
        setReportId(result.reportId);
        formElement.reset();
      } else if (response.status === 429) {
        setError("You’ve sent a few reports recently. Please try again in an hour.");
      } else {
        setError(result.error ?? "The report could not be sent. Please try again.");
      }
    } catch {
      setError("We couldn’t reach Snoozer. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="status-bug-section" id="report" aria-labelledby="status-bug-title">
      <div className="status-bug-prompt">
        <div className="status-bug-icon" aria-hidden="true">⌁</div>
        <div className="status-bug-copy">
          <p className="status-eyebrow">HELP US IMPROVE</p>
          <h2 id="status-bug-title">Something not working right?</h2>
          <p>Tell us what happened. Reports go straight to the Snoozer team for review.</p>
        </div>
        <button
          className="status-bug-toggle"
          type="button"
          aria-expanded={open}
          aria-controls="status-bug-form"
          onClick={() => {
            setOpen((value) => !value);
            setReportId(null);
            setError("");
          }}
        >
          {open ? "Close form" : "Report a bug"}
          <span aria-hidden="true">{open ? "−" : "↗"}</span>
        </button>
      </div>

      {open && (
        <div className="status-bug-form-panel" id="status-bug-form">
          {reportId ? (
            <div className="status-bug-success" role="status">
              <span className="status-bug-success-mark" aria-hidden="true">✓</span>
              <div>
                <h3>Report received. Thank you.</h3>
                <p>Your report has been added to our private review queue.</p>
                <p className="status-bug-reference">Reference <code>{reportId.slice(0, 8).toUpperCase()}</code></p>
              </div>
              <button type="button" className="status-bug-secondary" onClick={() => setReportId(null)}>
                Send another
              </button>
            </div>
          ) : (
            <form className="status-bug-form" onSubmit={submit}>
              <div className="status-bug-form-heading">
                <div>
                  <p className="status-eyebrow">BUG REPORT</p>
                  <h3>Tell us what went wrong</h3>
                </div>
                <span>Fields marked * are required</span>
              </div>

              <div className="status-bug-grid">
                <label>
                  Issue type *
                  <select name="category" defaultValue="bug" required>
                    {categories.map((category) => (
                      <option key={category.value} value={category.value}>{category.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Issue summary *
                  <input name="title" minLength={6} maxLength={120} placeholder="e.g. Profile editor will not save" required />
                </label>
              </div>

              <label>
                What happened? *
                <textarea name="description" minLength={20} maxLength={3000} rows={4}
                  placeholder="Describe what you expected to happen and what actually happened…" required />
              </label>

              <label>
                Steps to reproduce <span className="status-optional">(optional)</span>
                <textarea name="steps" maxLength={2500} rows={3}
                  placeholder={"1. Open the profile editor\n2. Change the background\n3. Select Save"} />
              </label>

              <div className="status-bug-grid">
                <label>
                  Email for follow-up <span className="status-optional">(optional)</span>
                  <input name="contactEmail" type="email" maxLength={254} placeholder="you@example.com" autoComplete="email" />
                </label>
                <div className="status-bug-privacy">
                  <span aria-hidden="true">↳</span>
                  <p>We include the page you were viewing and your browser type. Never include passwords, payment details or security codes.</p>
                </div>
              </div>

              <div className="status-bug-honeypot" aria-hidden="true">
                <label>Leave this field empty<input name="website" tabIndex={-1} autoComplete="off" /></label>
              </div>

              {error && <p className="status-bug-error" role="alert">{error}</p>}

              <div className="status-bug-form-actions">
                <p>Your report is private and only visible to the Snoozer team.</p>
                <button type="submit" className="status-bug-submit" disabled={submitting}>
                  {submitting ? "Sending report…" : "Send report"}
                  <span aria-hidden="true">↗</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
