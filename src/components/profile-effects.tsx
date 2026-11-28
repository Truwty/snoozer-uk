"use client";

import { useEffect, useRef, useState } from "react";
import type { ProfileEffects } from "@/lib/profile-effects";
import { tiltEffectAngles } from "@/lib/profile-effects";

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
    const layer = ref.current;
    const card = layer?.parentElement;
    const interaction = effects.interaction;
    const pointerEffects = ["tilt", "spotlight", "trail", "magnetic", "parallax", "cursor-glow", "ripple", "orbit"];
    const motion = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    if (!card || !effects.enabled || !pointerEffects.includes(interaction) || !motion.matches) return;
    let frame = 0;

    const clear = () => {
      card.style.removeProperty("--effect-x");
      card.style.removeProperty("--effect-y");
      card.style.removeProperty("--effect-tilt-x");
      card.style.removeProperty("--effect-tilt-y");
      card.style.removeProperty("--effect-tilt-scale");
      card.style.removeProperty("--effect-magnetic-x");
      card.style.removeProperty("--effect-magnetic-y");
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    };

    const move = (event: PointerEvent) => {
      const toggle = card.querySelector<HTMLInputElement>(".profile-effects-toggle input");
      if (toggle?.checked || !motion.matches) {
        clear();
        return;
      }
      const bounds = card.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
      const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        card.style.setProperty("--effect-x", `${(x * 100).toFixed(2)}%`);
        card.style.setProperty("--effect-y", `${(y * 100).toFixed(2)}%`);
        if (interaction === "tilt") {
          const angles = tiltEffectAngles(x, y, effects.intensity);
          card.style.setProperty("--effect-tilt-x", `${angles.rotateX}deg`);
          card.style.setProperty("--effect-tilt-y", `${angles.rotateY}deg`);
          card.style.setProperty("--effect-tilt-scale", String(1.02 + effects.intensity / 5000));
        }
        if (interaction === "magnetic") {
          const power = effects.intensity / 100;
          card.style.setProperty("--effect-magnetic-x", `${((x - 0.5) * 16 * power).toFixed(1)}px`);
          card.style.setProperty("--effect-magnetic-y", `${((y - 0.5) * 16 * power).toFixed(1)}px`);
        }
        frame = 0;
      });
    };

    const leave = () => {
      if (!motion.matches) return;
      if (interaction === "tilt") {
        card.style.setProperty("--effect-tilt-x", "0deg");
        card.style.setProperty("--effect-tilt-y", "0deg");
        card.style.setProperty("--effect-tilt-scale", "1");
        card.style.removeProperty("--effect-x");
        card.style.removeProperty("--effect-y");
      } else {
        clear();
      }
    };

    card.addEventListener("pointermove", move, { passive: true });
    card.addEventListener("pointerleave", leave);
    motion.addEventListener("change", clear);
    return () => {
      card.removeEventListener("pointermove", move);
      card.removeEventListener("pointerleave", leave);
      motion.removeEventListener("change", clear);
      clear();
    };
  }, [effects.enabled, effects.interaction, effects.intensity]);

  if (!effects.enabled) return null;
  const animatedBackgrounds = effects.background !== "none" && effects.background !== "gradient";
  return <div ref={ref} aria-hidden="true" className="profile-effects-layer"
    data-background={effects.background} data-particles={effects.particles} data-interaction={effects.interaction}
    data-paused={paused ? "true" : undefined} data-speed={effects.speed}
    style={{ opacity: effects.intensity / 100 }}>
    {animatedBackgrounds && Array.from({ length: 24 }, (_, i) =>
      <i key={i} style={{ left: `${(i * 47 + 13) % 100}%`, top: `${(i * 31 + 7) % 100}%`,
        animationDelay: `-${(i * 7) % 19}s` }} />)}
    {effects.particles !== "none" && Array.from({ length: 18 }, (_, i) =>
      <b key={i} style={{ left: `${(i * 59 + 11) % 100}%`, top: `${(i * 37 + 5) % 100}%`,
        animationDelay: `-${(i * 11) % 17}s` }} />)}
  </div>;
}
