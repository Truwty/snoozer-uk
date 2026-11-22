"use client";

import { useEffect, useRef, useState } from "react";
import type { ProfileEffects } from "@/lib/profile-effects";

export function ProfileEffectsLayer({ effects }: { effects: ProfileEffects }) {
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      setPaused(!entry.isIntersecting || document.hidden);
    });
    const visibility = () => setPaused(document.hidden);
    observer.observe(element);
    document.addEventListener("visibilitychange", visibility);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  if (!effects.enabled || effects.background === "none") return null;
  return <div ref={ref} aria-hidden="true" className="profile-effects-layer"
    data-background={effects.background} data-paused={paused ? "true" : undefined}
    data-speed={effects.speed} style={{ opacity: effects.intensity / 100 }}>
    {["stars", "snow", "rain"].includes(effects.background) && Array.from({ length: 24 }, (_, i) =>
      <i key={i} style={{ left: `${(i * 47 + 13) % 100}%`, top: `${(i * 31 + 7) % 100}%`,
        animationDelay: `-${(i * 7) % 19}s` }} />)}
  </div>;
}
