"use client";

import Link from "next/link";
import { useState } from "react";
import {
  defaultEffects, effectBackgrounds, effectBorders, effectParticles, effectLinks, effectTexts, effectInteractions,
  effectPresets, effectPresetsMap, effectTierForOption, type ProfileEffects, type EffectTier, type EffectGroup,
  effectsAllowed,
} from "@/lib/profile-effects";

const rank: Record<EffectTier, number> = { free: 0, plus: 1, pro: 2, studio: 3 };
const label = (value: string) => value.split("-").map((word) => word.slice(0, 1).toUpperCase() + word.slice(1)).join(" ");
const optionLabel = (group: EffectGroup, value: string) => {
  const tier = effectTierForOption(group, value);
  return tier === "free" ? label(value) : `${label(value)} · ${tier.toUpperCase()}`;
};

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

  function options(group: EffectGroup, values: readonly string[]) {
    return values.map((value) => <option key={value} value={value}
      disabled={rank[effectTierForOption(group, value)] > rank[tier]}>
      {optionLabel(group, value)}
    </option>);
  }

  return <fieldset className="stack effects-editor studio-reference-customization" data-effect-tier={tier}>
    <legend className="section-title">Advanced animations &amp; effects</legend>
    <p className="muted">Layer animated backgrounds, borders, particles, link motion, typography and pointer interactions. Respect for reduced-motion settings is built in.</p>
    <label className="check"><input type="checkbox" checked={effects.enabled}
      onChange={(event) => change({ ...effects, enabled: event.target.checked })}/> Enable effects</label>

    <div className="effects-editor-plan-guide" aria-label="Effect plan access">
      <span><strong>FREE</strong> Gradient</span>
      <span><strong>PLUS</strong> Layered visuals</span>
      <span><strong>PRO</strong> Interactive motion</span>
      <span><strong>STUDIO</strong> Exclusive effects</span>
    </div>

    <label htmlFor="profile-effect-background">Background Effects</label>
    <select id="profile-effect-background" aria-label="Background Effects" value={effects.background}
      onChange={(event) => changeLayer("background", event.target.value as ProfileEffects["background"])}>
      {options("background", effectBackgrounds)}
    </select>

    <label>Border Effects<select aria-label="Effect border" value={effects.border}
      onChange={(event) => changeLayer("border", event.target.value as ProfileEffects["border"])}>
      {options("border", effectBorders)}
    </select></label>

    <label>Particles<select aria-label="Effect particles" value={effects.particles}
      onChange={(event) => changeLayer("particles", event.target.value as ProfileEffects["particles"])}>
      {options("particles", effectParticles)}
    </select></label>

    <label>Link animations<select aria-label="Link animations" value={effects.links}
      onChange={(event) => changeLayer("links", event.target.value as ProfileEffects["links"])}>
      {options("links", effectLinks)}
    </select></label>

    <label htmlFor="profile-effect-text">Username Effects</label>
    <select id="profile-effect-text" aria-label="Username Effects" value={effects.text}
      onChange={(event) => changeLayer("text", event.target.value as ProfileEffects["text"])}>
      {options("text", effectTexts)}
    </select>

    <label>Pointer Interactions<select aria-label="Effect interaction" value={effects.interaction}
      onChange={(event) => changeLayer("interaction", event.target.value as ProfileEffects["interaction"])}>
      {options("interaction", effectInteractions)}
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
      {options("preset", effectPresets)}
    </select></label>

    {(!supported || blocked) && <p role="alert" className="message error">
      This effect is locked or the combination exceeds your plan. Free includes Gradient; Plus unlocks layered effects; Pro adds interactive effects; Studio unlocks exclusive effects and presets. <Link href="/pricing">Compare plans</Link>.
    </p>}
    <p className="muted effects-editor-help">Locked options are shown in the list with their required plan. Changes are checked again when you save and publish.</p>
    <button type="button" className="button small" onClick={() => { setBlocked(false); onChange(defaultEffects); }}>Reset all effects</button>
  </fieldset>;
}
