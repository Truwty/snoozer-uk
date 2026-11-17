"use client";

import { useState } from "react";
import { defaultAppearance, type PublishedProfile } from "@/lib/profile";
import { ProfileCard } from "./profile-card";

const themes = [
  { value: "midnight", label: "Midnight" },
  { value: "lagoon", label: "Lagoon" },
  { value: "daybreak", label: "Daybreak" },
] as const;
const layouts = [
  { value: "centred", label: "Centred" },
  { value: "editorial", label: "Editorial" },
] as const;

export function HomeProfileDemo() {
  const [theme, setTheme] = useState<PublishedProfile["theme"]>("midnight");
  const [layout, setLayout] = useState<PublishedProfile["appearance"]["layout"]>("centred");

  return <div className="home-demo">
    <div className="home-demo-bar"><span>Profile preview</span><span>Example · snoozer.uk/afterhours</span></div>
    <ProfileCard preview previewLabel="Example profile" profile={{
      username: "afterhours",
      display_name: "After Hours",
      bio: "Design notes, late-night playlists and things worth keeping.",
      theme,
      indexable: false,
      avatar: null,
      appearance: { ...defaultAppearance, layout },
      gallery: [],
      links: [],
      sections: [{ heading: "Currently making", body: "A field guide to small, beautiful things.", kind: "callout" }],
    }} />
    <div className="home-demo-controls">
      <fieldset>
        <legend>Theme</legend>
        <div className="actions">
          {themes.map(({ value, label }) => <button key={value} type="button" className="demo-option"
            aria-pressed={theme === value} onClick={() => setTheme(value)}>
            <span className="demo-swatch" data-theme={value} aria-hidden="true" />{label}
          </button>)}
        </div>
      </fieldset>
      <fieldset>
        <legend>Layout</legend>
        <div className="actions">
          {layouts.map(({ value, label }) => <button key={value} type="button" className="demo-option"
            aria-pressed={layout === value} onClick={() => setLayout(value)}>{label}</button>)}
        </div>
      </fieldset>
    </div>
  </div>;
}
