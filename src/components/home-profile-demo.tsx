"use client";

import Image from "next/image";
import { useState } from "react";

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
  const [theme, setTheme] = useState<(typeof themes)[number]["value"]>("midnight");
  const [layout, setLayout] = useState<(typeof layouts)[number]["value"]>("centred");

  return <div className="hi-demo" role="group" aria-label="Interactive preview of a Snoozer profile">
    <div className="hi-demo-scene">
      <Image
        className="hi-demo-background"
        src="https://images.unsplash.com/photo-1510519138101-570d1dca3d66?auto=format&fit=crop&w=1400&q=85"
        alt="A creative desk setup used as the background for the profile preview."
        fill unoptimized sizes="(max-width: 760px) 100vw, 50vw"
      />
      <div className="hi-demo-scene-shade" aria-hidden="true" />
      <div className={"hi-demo-profile theme-" + theme} data-layout={layout} role="region" aria-label="Example profile">
        <div className="hi-demo-avatar">
          <Image
            src="https://images.unsplash.com/photo-1758613655800-98248330920d?auto=format&fit=crop&w=240&h=240&q=85"
            alt="Portrait used in the example creator profile."
            fill unoptimized sizes="80px"
          />
        </div>
        <p className="hi-demo-profile-kicker">SNOOZER / PROFILE</p>
        <h3>After Hours<span aria-hidden="true">✳</span></h3>
        <p className="hi-demo-bio">Design notes, late-night playlists and things worth keeping.</p>
        <div className="hi-demo-profile-links" aria-label="Example profile links">
          <span>PORTFOLIO <b>↗</b></span>
          <span>INSTAGRAM <b>↗</b></span>
          <span>MY PROJECTS <b>↗</b></span>
        </div>
        <span className="hi-demo-profile-address">snoozer.uk/afterhours</span>
      </div>
      <span className="hi-demo-live"><i aria-hidden="true" /> LIVE PREVIEW</span>
    </div>

    <div className="hi-demo-controls">
      <fieldset>
        <legend>Theme</legend>
        <div className="hi-demo-options">
          {themes.map(({ value, label }) => <button
            key={value} type="button" className="hi-demo-choice"
            aria-pressed={theme === value} onClick={() => setTheme(value)}
          >
            <i className={"hi-demo-swatch hi-demo-swatch-" + value} aria-hidden="true" />
            {label}
          </button>)}
        </div>
      </fieldset>
      <fieldset>
        <legend>Layout</legend>
        <div className="hi-demo-options">
          {layouts.map(({ value, label }) => <button
            key={value} type="button" className="hi-demo-choice"
            aria-pressed={layout === value} onClick={() => setLayout(value)}
          >{label}</button>)}
        </div>
      </fieldset>
      <p>Your choices update the preview straight away.</p>
    </div>
  </div>;
}
