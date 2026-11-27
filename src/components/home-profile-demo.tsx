"use client";

import { defaultAppearance, type PublishedProfile } from "@/lib/profile";
import { defaultProfileWidgets } from "@/lib/profile-widgets";
import { ProfileCard } from "./profile-card";
import type { AccountLocale } from "@/lib/account-locale";
import { homeDemoContent } from "@/lib/home-demo-translations";

type SampleProfile = {
  username: string;
  displayName: string;
  bio: string;
  theme: PublishedProfile["theme"];
  accent: string;
  links: PublishedProfile["links"];
  heading: string;
  detail: string;
};

function makeProfile(sample: SampleProfile): PublishedProfile {
  return {
    seo: { title: "", description: "" },
    username: sample.username,
    display_name: sample.displayName,
    bio: sample.bio,
    theme: sample.theme,
    appearance: {
      ...defaultAppearance,
      density: "compact",
      corners: "round",
      colors: { accent: sample.accent },
    },
    indexable: false,
    avatar: null,
    gallery: [],
    badges: [],
    widgets: defaultProfileWidgets,
    blocks: [],
    pageLayout: { version: 1, items: [] },
    links: sample.links,
    sections: [{ heading: sample.heading, body: sample.detail, kind: "callout" }],
  };
}

const profiles = [
  {
    position: "back-left",
    label: "Creator profile example",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&h=240&q=85",
    background: "city",
    profile: makeProfile({
      username: "ethan",
      displayName: "Ethan",
      bio: "Building things, playing games and sharing the process.",
      theme: "midnight",
      accent: "#d8fb86",
      links: [
        { label: "Portfolio", url: "https://example.com/" },
        { label: "GitHub", url: "https://github.com/" },
        { label: "Discord", url: "https://discord.com/" },
      ],
      heading: "Currently building",
      detail: "Small projects. Big ideas. More soon.",
    }),
  },
  {
    position: "front",
    label: "Featured creator profile example",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&h=240&q=85",
    background: "coast",
    profile: makeProfile({
      username: "mira",
      displayName: "Mira",
      bio: "Art, odd little projects and everything in between.",
      theme: "lagoon",
      accent: "#b5f4dc",
      links: [
        { label: "My work", url: "https://example.com/portfolio" },
        { label: "Instagram", url: "https://instagram.com/" },
        { label: "Pinterest", url: "https://pinterest.com/" },
        { label: "Discord", url: "https://discord.com/" },
      ],
      heading: "A little about me",
      detail: "Collecting ideas, making things and finding new inspiration.",
    }),
  },
  {
    position: "back-right",
    label: "Artist profile example",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=240&h=240&q=85",
    background: "mountain",
    profile: makeProfile({
      username: "kai",
      displayName: "Kai",
      bio: "Digital creator | design, music and late-night ideas.",
      theme: "daybreak",
      accent: "#b69cff",
      links: [
        { label: "My projects", url: "https://example.com/projects" },
        { label: "YouTube", url: "https://youtube.com/" },
        { label: "TikTok", url: "https://tiktok.com/" },
      ],
      heading: "Find me online",
      detail: "New work, videos and whatever I'm making next.",
    }),
  },
] as const;

function DashboardPreview({ locale }: { locale: AccountLocale }) {
  const copy = homeDemoContent(locale);
  return (
    <div className="home-dashboard-preview">
      <aside className="home-dashboard-sidebar">
        <div className="home-dashboard-brand"><span>☾</span> snoozer<span className="home-dashboard-brand-dot">.</span></div>
        <p className="home-dashboard-sidebar-label">{copy.yourSpace}</p>
        <nav aria-label={copy.exampleNavigation}>
          <span className="is-active"><i>◉</i> {copy.account}</span>
          <span><i>✎</i> {copy.customize}</span>
          <span><i>↗</i> {copy.links}</span>
          <span><i>✳</i> {copy.premium}</span>
          <span><i>▧</i> {copy.imageHost}</span>
        </nav>
        <div className="home-dashboard-sidebar-bottom">
          <span className="home-dashboard-avatar">A</span>
          <span><strong>After Hours</strong><small>Example profile</small></span>
        </div>
      </aside>

      <div className="home-dashboard-main">
        <div className="home-dashboard-heading">
          <div><p>{copy.accountOverview}</p><h3>{copy.dashboard}</h3></div>
          <span className="home-dashboard-preview-label">{copy.example}</span>
        </div>
        <div className="home-dashboard-stats">
          <div><small>{copy.username}</small><strong>@afterhours</strong></div>
          <div><small>{copy.alias}</small><strong>After Hours</strong></div>
          <div><small>{copy.profileViews}</small><strong>4,807</strong></div>
          <div><small>{copy.pageStatus}</small><strong><i /> {copy.published}</strong></div>
        </div>
        <div className="home-dashboard-lower">
          <section className="home-dashboard-chart">
            <div className="home-dashboard-panel-heading"><div><strong>{copy.viewsTitle}</strong><small>{copy.activity}</small></div><span>{copy.lastSevenDays}</span></div>
            <svg viewBox="0 0 720 190" preserveAspectRatio="none" aria-hidden="true">
              <defs><linearGradient id="home-chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#d8fb86" stopOpacity=".32"/><stop offset="100%" stopColor="#d8fb86" stopOpacity="0"/></linearGradient></defs>
              <path className="home-chart-grid" d="M0 30H720M0 75H720M0 120H720M0 165H720"/>
              <path className="home-chart-area" d="M0 130 C45 130 48 125 80 112 S128 64 164 93 S213 151 250 70 S310 105 345 117 S392 145 425 89 S474 42 510 92 S565 146 595 85 S663 108 720 30 L720 190 L0 190Z"/>
              <path className="home-chart-line" d="M0 130 C45 130 48 125 80 112 S128 64 164 93 S213 151 250 70 S310 105 345 117 S392 145 425 89 S474 42 510 92 S565 146 595 85 S663 108 720 30"/>
            </svg>
            <div className="home-dashboard-chart-labels">{copy.weekdays.map((day) => <span key={day}>{day}</span>)}</div>
          </section>
          <section className="home-dashboard-actions">
            <strong>{copy.manageAccount}</strong>
            <small>{copy.quickLinks}</small>
            <span>✎ &nbsp; {copy.changeUsername}</span>
            <span>◉ &nbsp; {copy.changeDisplayName}</span>
            <span>⌘ &nbsp; {copy.accountSettings}</span>
            <span className="home-dashboard-discord"><b>●</b> {copy.discordConnected}</span>
          </section>
        </div>
        <div className="home-dashboard-footer">© 2026 Snoozer.uk <span>{copy.tagline}</span></div>
      </div>
    </div>
  );
}

export function HomeProfileDemo({ locale = "en-US" }: { locale?: AccountLocale }) {
  const copy = homeDemoContent(locale);
  return (
    <div
      className="home-profile-showcase"
      role="img"
      aria-label={copy.alt}
    >
      <DashboardPreview locale={locale} />
      <div className="home-profile-showcase-cards" aria-hidden="true" inert>
        {profiles.map((item) => (
          <article
            className={
              "home-profile-preview home-profile-preview--" +
              item.position +
              " home-profile-preview--" +
              item.background
            }
            key={item.position}
          >
            <ProfileCard
              profile={item.profile}
              avatarSrc={item.avatar}
              preview
              previewLabel={item.label}
            />
          </article>
        ))}
      </div>
      <div className="home-profile-showcase-fade" aria-hidden="true" />
    </div>
  );
}
