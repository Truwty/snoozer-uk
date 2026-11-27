"use client";

import Link from "next/link";
import { useState } from "react";
import {
  defaultEffects, effectBackgrounds, effectBorders, effectParticles, effectLinks, effectTexts, effectInteractions,
  effectPresetsMap, type ProfileEffects, type EffectTier, effectsAllowed,
} from "@/lib/profile-effects";

const label = (value: string) => value.split("-").map((word) => word.slice(0, 1).toUpperCase() + word.slice(1)).join(" ");

export function EffectsEditor({ value, tier, onChange }: {
  value?: ProfileEffects; tier: EffectTier; onChange: (effects: ProfileEffects) => void;
}) {
  const effects = value ?? defaultEffects;
  const [blocked, setBlocked] = useState(false);
  const supported = effectsAllowed(effects, tier);

  function change(next: ProfileEffects) {
    if (!effectsAllowed(next, tier)) {
      setBlocked(true);
      return;
    }
    setBlocked(false);
    onChange(next);
  }

  function changeLayer<K extends "background" | "border" | "particles" | "links" | "text" | "interaction">(
    key: K,
    nextValue: ProfileEffects[K],
  ) {
    change({
      ...effects,
      [key]: nextValue,
      preset: "none",
      enabled: nextValue !== "none" || effects.enabled,
    });
  }

  return <fieldset className="stack effects-editor studio-reference-customization">
    <legend className="section-title">Advanced animations &amp; effects</legend>
    <p className="muted">Build a layered profile. Effects respect each visitor’s reduced-motion setting.</p>
    <label className="check"><input type="checkbox" checked={effects.enabled}
      onChange={(event) => change({ ...effects, enabled: event.target.checked })}/> Enable effects</label>

    <label htmlFor="profile-effect-background">Background Effects</label>
    <select id="profile-effect-background" aria-label="Background Effects" value={effects.background}
      onChange={(event) => changeLayer("background", event.target.value as ProfileEffects["background"])}>
      {effectBackgrounds.map((v) => <option key={v} value={v}>{label(v)}</option>)}
    </select>

    <label>Border<select aria-label="Effect border" value={effects.border}
      onChange={(event) => changeLayer("border", event.target.value as ProfileEffects["border"])}>
      {effectBorders.map((v) => <option key={v} value={v}>{label(v)}</option>)}
    </select></label>

    <label>Particles<select aria-label="Effect particles" value={effects.particles}
      onChange={(event) => changeLayer("particles", event.target.value as ProfileEffects["particles"])}>
      {effectParticles.map((v) => <option key={v} value={v}>{label(v)}</option>)}
    </select></label>

    <label>Link animations<select aria-label="Link animations" value={effects.links}
      onChange={(event) => changeLayer("links", event.target.value as ProfileEffects["links"])}>
      {effectLinks.map((v) => <option key={v} value={v}>{label(v)}</option>)}
    </select></label>

    <label htmlFor="profile-effect-text">Username Effects</label>
    <select id="profile-effect-text" aria-label="Username Effects" value={effects.text}
      onChange={(event) => changeLayer("text", event.target.value as ProfileEffects["text"])}>
      {effectTexts.map((v) => <option key={v} value={v}>{label(v)}</option>)}
    </select>

    <label>Interaction<select aria-label="Effect interaction" value={effects.interaction}
      onChange={(event) => changeLayer("interaction", event.target.value as ProfileEffects["interaction"])}>
      {effectInteractions.map((v) => <option key={v} value={v}>{label(v)}</option>)}
    </select></label>

    <label>Intensity: {effects.intensity}%<input type="range" min={0} max={100} step={5} value={effects.intensity}
      onChange={(event) => change({ ...effects, intensity: Number(event.target.value) })}/></label>

    <label>Animation speed<select aria-label="Animation speed" value={effects.speed}
      onChange={(event) => change({ ...effects, speed: event.target.value as ProfileEffects["speed"] })}>
      <option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option>
    </select></label>

    <label>Effect preset<select aria-label="Effect preset" value={effects.preset} onChange={(event) => {
      const preset = event.target.value as ProfileEffects["preset"];
      change(preset === "none" ? { ...effects, preset } : { ...effects, ...effectPresetsMap[preset], preset, enabled: true });
    }}>
      <option value="none">Custom / none</option>
      {Object.keys(effectPresetsMap).map((preset) => <option key={preset} value={preset}>{label(preset)}</option>)}
    </select></label>

    {(!supported || blocked) && <p role="alert" className="message error">
      This combination exceeds your current plan. The unsupported change was not applied. Plus allows two visual layers; Pro unlocks interactions; Studio unlocks exclusive presets. <Link href="/pricing">Compare plans</Link>.
    </p>}
    <button type="button" className="button small" onClick={() => { setBlocked(false); onChange(defaultEffects); }}>Reset all effects</button>
  </fieldset>;
}
