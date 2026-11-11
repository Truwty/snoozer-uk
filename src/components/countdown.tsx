"use client";

import { useEffect, useState } from "react";
import { countdownRemaining } from "@/lib/countdown";

export function Countdown({ target }: { target: number }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    let timeout: number;
    function tick() {
      const { label, nextUpdate } = countdownRemaining(target, Date.now());
      setLabel(label);
      if (nextUpdate !== null) timeout = window.setTimeout(tick, nextUpdate);
    }
    function refresh() {
      window.clearTimeout(timeout);
      tick();
    }
    timeout = window.setTimeout(tick, 0);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [target]);

  return label ? <p className="countdown-remaining">{label}</p> : null;
}
