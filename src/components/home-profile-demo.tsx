"use client";

import { useState } from "react";
import { defaultAppearance, type PublishedProfile } from "@/lib/profile";
import { ProfileCard } from "./profile-card";
import { defaultProfileWidgets } from "@/lib/profile-widgets";

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
    <ProfileCard avatarSrc="/icon.svg" preview previewLabel="Example profile" profile={{ seo: { title: "", description: "" },
      username: "afterhours",
      display_name: "After Hours",
      bio: "Design notes, late-night playlists and things worth keeping.",
      theme,
      indexable: false,
      avatar: null,
      widgets: defaultProfileWidgets,
      blocks: [],
      appearance: { ...defaultAppearance, layout },
      pageLayout: { version: 1, items: [] },
      gallery: [],
      links: [
        { label: "GitHub", url: "https://github.com/" }, { label: "YouTube", url: "https://www.youtube.com/" },
        { label: "Twitch", url: "https://www.twitch.tv/" }, { label: "Discord", url: "https://discord.com/" },
        { label: "Ko-fi", url: "https://ko-fi.com/" },
      ],
      sections: [{ heading: "Currently making", body: "A field guide to small, beautiful things.", kind: "callout" }],
    }} />
    <nav className="social-links" aria-label="Example social links">
      <a href="https://github.com/" aria-label="GitHub"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4 4 2v6a8 8 0 0 0 4 14v-4c-3 0-4-2-4-3m12 7v-4a4 4 0 0 0-1-3 8 8 0 0 0 5-7V2l-3 2a12 12 0 0 0-10 0Z"/></svg></a>
      <a href="https://www.youtube.com/" aria-label="YouTube"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3Z"/></svg></a>
      <a href="https://www.twitch.tv/" aria-label="Twitch"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2h18v14l-6 6h-6v-4H4Z M10 6v6m6-6v6"/></svg></a>
    </nav>
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
