"use client";

import { useRef, useState } from "react";
import { appearanceTransferLimit, exportAppearance, importAppearance, type AppearanceSettings } from "@/lib/appearance-transfer";

export function AppearanceTransfer({ settings, onApply }: {
  settings: AppearanceSettings;
  onApply: (settings: AppearanceSettings) => void;
}) {
  const code = useRef<HTMLTextAreaElement>(null);
  const [pasted, setPasted] = useState("");
  const [message, setMessage] = useState("");
  const [invalid, setInvalid] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(exportAppearance(settings));
      setMessage("Appearance code copied.");
    } catch {
      code.current?.focus();
      code.current?.select();
      setMessage("Code selected. Use your device's copy command.");
    }
  }

  function apply() {
    const appearance = importAppearance(pasted);
    if (!appearance) {
      setMessage("");
      setInvalid(true);
      return;
    }
    onApply(appearance);
    setPasted("");
    setInvalid(false);
    setMessage("Appearance applied to your draft.");
  }

  return <details className="link-editor">
    <summary>Copy or paste appearance</summary>
    <div className="stack">
      <label>Current appearance code
        <textarea ref={code} readOnly rows={3} value={exportAppearance(settings)} />
      </label>
      <div><button type="button" className="button small" onClick={() => void copy()}>Copy appearance</button></div>
      <label>Paste an appearance code
        <textarea value={pasted} rows={3} maxLength={appearanceTransferLimit} spellCheck={false}
          aria-invalid={invalid || undefined} aria-describedby={invalid ? "appearance-transfer-error" : undefined}
          onChange={(event) => { setPasted(event.target.value); setInvalid(false); }} />
      </label>
      {invalid && <p id="appearance-transfer-error" role="alert">Enter a valid Snoozer appearance code.</p>}
      <div><button type="button" className="button small" onClick={apply} disabled={!pasted.trim()}>Apply appearance</button></div>
      <p aria-live="polite">{message}</p>
    </div>
  </details>;
}
