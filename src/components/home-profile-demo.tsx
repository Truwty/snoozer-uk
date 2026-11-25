"use client";

import { defaultAppearance, type PublishedProfile } from "@/lib/profile";
import { defaultProfileWidgets } from "@/lib/profile-widgets";
import { ProfileCard } from "./profile-card";

type SampleProfile = {
  username: string;
  displayName: string;
  bio: string;
  theme: PublishedProfile["theme"];
  accent: string;
  avatar: string;
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
      avatar: "",
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
      avatar: "",
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
      avatar: "",
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

export function HomeProfileDemo() {
  return (
    <div
      className="home-profile-showcase"
      role="img"
      aria-label="Three example Snoozer profile pages, each with its own avatar, background, bio and social links."
    >
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
      <span className="home-profile-showcase-caption" aria-hidden="true">
        YOUR PAGE · YOUR STYLE · YOURS TO SHARE
      </span>
    </div>
  );
}
