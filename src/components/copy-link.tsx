"use client";

import { useState } from "react";

export function CopyLink({ path }: { path: string }) {
  const [message, setMessage] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
      setMessage("Page link copied.");
    } catch {
      setMessage("Couldn’t copy. Open the live page and copy the address from your browser.");
    }
  }

  return <div>
    <button type="button" className="button small" onClick={copy}>Copy page link</button>
    {message && <p className="message" role="status">{message}</p>}
  </div>;
}
