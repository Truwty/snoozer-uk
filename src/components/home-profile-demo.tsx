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
  const currentTheme = themes.find((item) => item.value === theme)?.label ?? "Midnight";

  return <div className="home-showcase" role="group" aria-label="Interactive preview of a Snoozer profile">
    <div className="home-showcase-board">
      <div className="home-showcase-windowbar">
        <span className="home-showcase-window-dots" aria-hidden="true"><i /><i /><i /></span>
        <span className="home-showcase-window-title">SNOOZER STUDIO <span>/</span> PROFILE</span>
        <span className="home-showcase-live"><i aria-hidden="true" /> LIVE PREVIEW</span>
      </div>
      <div className="home-showcase-workspace">
        <aside className="home-showcase-sidebar" aria-hidden="true">
          <p className="home-showcase-sidebar-label">YOUR WORKSPACE</p>
          <span className="home-showcase-sidebar-link is-active"><i>◌</i> Overview</span>
          <span className="home-showcase-sidebar-link"><i>◈</i> Appearance</span>
          <span className="home-showcase-sidebar-link"><i>↗</i> Links</span>
          <span className="home-showcase-sidebar-link"><i>▧</i> Gallery</span>
          <span className="home-showcase-sidebar-link"><i>⌘</i> Settings</span>
          <div className="home-showcase-sidebar-bottom"><span className="home-sidebar-avatar">A</span><span><strong>After Hours</strong><small>Example profile</small></span></div>
        </aside>
        <div className="home-showcase-editor">
          <div className="home-showcase-editor-heading">
            <div><p className="eyebrow">PROFILE OVERVIEW</p><h3>Make it yours.</h3></div>
            <span className="home-showcase-status"><i aria-hidden="true" /> Draft preview</span>
          </div>
          <div className="home-showcase-quick-stats" aria-hidden="true">
            <div><span>YOUR ADDRESS</span><strong>snoozer.uk/afterhours</strong></div>
            <div><span>PAGE STATUS</span><strong>Draft</strong></div>
            <div><span>ACTIVE THEME</span><strong>{currentTheme}</strong></div>
          </div>
          <div className="home-showcase-content">
            <div className="home-showcase-preview">
              <ProfileCard avatarSrc="/icon.svg" preview previewLabel="Example profile" profile={{
                seo: { title: "", description: "" },
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
                  { label: "GitHub", url: "https://github.com/" },
                  { label: "YouTube", url: "https://www.youtube.com/" },
                  { label: "Twitch", url: "https://www.twitch.tv/" },
                  { label: "Discord", url: "https://discord.com/" },
                ],
                sections: [{ heading: "Currently making", body: "A field guide to small, beautiful things.", kind: "callout" }],
              }} />
            </div>
            <div className="home-demo-controls">
              <fieldset>
                <legend>Choose a theme</legend>
                <div className="home-demo-theme-options">
                  {themes.map(({ value, label }) => <button key={value} type="button" className="demo-option"
                    aria-pressed={theme === value} onClick={() => setTheme(value)}>
                    <span className="demo-swatch" data-theme={value} aria-hidden="true" />{label}
                  </button>)}
                </div>
              </fieldset>
              <fieldset>
                <legend>Try a layout</legend>
                <div className="home-demo-layout-options">
                  {layouts.map(({ value, label }) => <button key={value} type="button" className="demo-option"
                    aria-pressed={layout === value} onClick={() => setLayout(value)}>{label}</button>)}
                </div>
              </fieldset>
              <p className="home-showcase-hint">Change the options to see your preview update.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="home-showcase-floating" aria-hidden="true">
      <article className="home-float-card home-float-card--one">
        <div className="home-float-cover"><span>✦</span><i /><i /></div>
        <div className="home-float-identity"><span className="home-float-avatar">J</span><div><strong>Jules</strong><small>Designer &amp; maker</small></div></div>
        <div className="home-float-lines"><i /><i /><i /></div>
        <div className="home-float-links"><span>LINKS</span><i /><i /><i /></div>
      </article>
      <article className="home-float-card home-float-card--two">
        <div className="home-float-cover"><span>☾</span><i /><i /></div>
        <div className="home-float-identity"><span className="home-float-avatar">M</span><div><strong>Mira</strong><small>Illustrator &amp; artist</small></div></div>
        <div className="home-float-lines"><i /><i /><i /></div>
        <div className="home-float-links"><span>MY SPACE</span><i /><i /><i /></div>
      </article>
      <article className="home-float-card home-float-card--three">
        <div className="home-float-cover"><span>◒</span><i /><i /></div>
        <div className="home-float-identity"><span className="home-float-avatar">K</span><div><strong>Kai</strong><small>Developer &amp; creator</small></div></div>
        <div className="home-float-lines"><i /><i /><i /></div>
        <div className="home-float-links"><span>FIND ME</span><i /><i /><i /></div>
      </article>
    </div>
  </div>;
}
