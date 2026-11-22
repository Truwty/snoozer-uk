"use client";

import Link from "next/link";
import {
  defaultEffects, effectBackgrounds, effectBorders, effectParticles, effectLinks, effectTexts, effectInteractions,
  effectPresetsMap, type ProfileEffects, type EffectTier, effectsAllowed,
} from "@/lib/profile-effects";

const label = (value: string) => value.split("-").map((word) => word.slice(0, 1).toUpperCase() + word.slice(1)).join(" ");

export function EffectsEditor({ value, tier, onChange }: {
  value?: ProfileEffects; tier: EffectTier; onChange: (effects: ProfileEffects) => void;
}) {
  const effects = value ?? defaultEffects;
  const change = (next: ProfileEffects) => onChange(next);
  const supported = effectsAllowed(effects, tier);
  return <fieldset className="stack effects-editor">
    <legend className="section-title">Advanced animations & effects</legend>
    <p className="muted">Build a layered profile. Effects are optional and disabled for visitors requesting reduced motion.</p>
    <label className="check"><input type="checkbox" checked={effects.enabled}
      onChange={(event) => change({ ...effects, enabled: event.target.checked })}/> Enable effects</label>
    <label htmlFor="profile-effect-background">Effect background</label><select id="profile-effect-background" aria-label="Effect background" value={effects.background} onChange={(event) => change({ ...effects, background: event.target.value as ProfileEffects["background"], preset: "none" })}>
      {effectBackgrounds.map((v) => <option key={v} value={v}>{label(v)}</option>)}
    </select>
    <label>Border<select value={effects.border} onChange={(event) => change({ ...effects, border: event.target.value as ProfileEffects["border"], preset: "none" })}>
      {effectBorders.map((v) => <option key={v} value={v}>{label(v)}</option>)}
    </select></label>
    <label>Particles<select value={effects.particles} onChange={(event) => change({ ...effects, particles: event.target.value as ProfileEffects["particles"], preset: "none" })}>
      {effectParticles.map((v) => <option key={v} value={v}>{label(v)}</option>)}
    </select></label>
    <label>Link animations<select value={effects.links} onChange={(event) => change({ ...effects, links: event.target.value as ProfileEffects["links"], preset: "none" })}>
      {effectLinks.map((v) => <option key={v} value={v}>{label(v)}</option>)}
    </select></label>
    <label>Typography<select value={effects.text} onChange={(event) => change({ ...effects, text: event.target.value as ProfileEffects["text"], preset: "none" })}>
      {effectTexts.map((v) => <option key={v} value={v}>{label(v)}</option>)}
    </select></label>
    <label>Interaction<select value={effects.interaction} onChange={(event) => change({ ...effects, interaction: event.target.value as ProfileEffects["interaction"], preset: "none" })}>
      {effectInteractions.map((v) => <option key={v} value={v}>{label(v)}</option>)}
    </select></label>
    <label>Intensity: {effects.intensity}%<input type="range" min={0} max={100} step={5} value={effects.intensity}
      onChange={(event) => change({ ...effects, intensity: Number(event.target.value) })}/></label>
    <label>Animation speed<select value={effects.speed} onChange={(event) => change({ ...effects, speed: event.target.value as ProfileEffects["speed"] })}>
      <option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option>
    </select></label>
    <label>Effect preset<select value={effects.preset} onChange={(event) => {
      const preset = event.target.value as ProfileEffects["preset"];
      change(preset === "none" ? { ...effects, preset } : { ...effects, ...effectPresetsMap[preset], preset, enabled: true });
    }}>
      <option value="none">Custom / none</option>
      {Object.keys(effectPresetsMap).map((preset) => <option key={preset} value={preset}>{label(preset)}</option>)}
    </select></label>
    {!supported && <p role="alert" className="message error">This combination exceeds your current plan. Plus allows two visual layers; Pro unlocks interactions; Studio unlocks exclusive presets. <Link href="/pricing">Compare plans</Link>.</p>}
    <button type="button" className="button small" onClick={() => change(defaultEffects)}>Reset all effects</button>
  </fieldset>;
}
