"use client";

import { useEffect, useRef, useState } from "react";
import type { ProfileEffects } from "@/lib/profile-effects";

export function ProfileEffectsLayer({ effects }: { effects: ProfileEffects }) {
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const layer = ref.current;
    if (!layer) return;
    const observer = new IntersectionObserver(([entry]) => {
      setPaused(!entry.isIntersecting || document.hidden);
    });
    const visibility = () => setPaused(document.hidden);
    observer.observe(layer);
    document.addEventListener("visibilitychange", visibility);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", visibility); };
  }, []);

  useEffect(() => {
    const card = ref.current?.parentElement;
    if (!card || !effects.enabled || !["spotlight", "trail"].includes(effects.interaction)
      || !window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    let frame = 0;
    let x = 50, y = 50;
    const draw = () => {
      card.style.setProperty("--effect-x", `${x}%`);
      card.style.setProperty("--effect-y", `${y}%`);
      frame = 0;
    };
    const move = (event: PointerEvent) => {
      const bounds = card.getBoundingClientRect();
      x = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100));
      y = Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100));
      if (!frame) frame = window.requestAnimationFrame(draw);
    };
    card.addEventListener("pointermove", move, { passive: true });
    return () => {
      card.removeEventListener("pointermove", move);
      if (frame) window.cancelAnimationFrame(frame);
      card.style.removeProperty("--effect-x");
      card.style.removeProperty("--effect-y");
    };
  }, [effects.enabled, effects.interaction]);

  if (!effects.enabled) return null;
  return <div ref={ref} aria-hidden="true" className="profile-effects-layer"
    data-background={effects.background} data-particles={effects.particles} data-interaction={effects.interaction}
    data-paused={paused ? "true" : undefined} data-speed={effects.speed}
    style={{ opacity: effects.intensity / 100 }}>
    {["stars", "snow", "rain"].includes(effects.background) && Array.from({ length: 24 }, (_, i) =>
      <i key={i} style={{ left: `${(i * 47 + 13) % 100}%`, top: `${(i * 31 + 7) % 100}%`,
        animationDelay: `-${(i * 7) % 19}s` }} />)}
    {effects.particles !== "none" && Array.from({ length: 18 }, (_, i) =>
      <b key={i} style={{ left: `${(i * 59 + 11) % 100}%`, top: `${(i * 37 + 5) % 100}%`,
        animationDelay: `-${(i * 11) % 17}s` }} />)}
  </div>;
}
