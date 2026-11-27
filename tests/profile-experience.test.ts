import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProfileCard } from "../src/components/profile-card";
import { defaultAppearance, publishedProfile } from "../src/lib/profile";
import { defaultProfileWidgets } from "../src/lib/profile-widgets";

function profileWith(overrides: Record<string, unknown> = {}) {
  const widgets = structuredClone(defaultProfileWidgets);
  widgets.guestbook.enabled = true;

  return publishedProfile.parse({
    username: "bio-page-example",
    display_name: "Bio Page Example",
    bio: "A short creator bio for the new profile layout.",
    theme: "midnight",
    indexable: false,
    avatar: null,
    appearance: { ...defaultAppearance, layout: "editorial", opacity: 40, blur: 20 },
    links: [
      { label: "Instagram", url: "https://instagram.com/example" },
      { label: "Midnight Drive — Demo Artist", url: "https://cdn.example.com/audio/midnight-drive.mp3" },
    ],
    sections: [{ heading: "About me", body: "This section is hidden in the compact bio experience." }],
    widgets,
    ...overrides,
  });
}

describe("compact public bio experience", () => {
  it("renders a centred entry overlay, monochrome social icons and a compact native audio player", () => {
    const profile = profileWith();
    const html = renderToStaticMarkup(createElement(ProfileCard, {
      profile,
      entryExperience: true,
      avatarSrc: "/media/avatar/bio-page-example/avatar.png",
    }));

    expect(html).toContain("profile-card--bio-experience");
    expect(html).toContain("profile-entry-overlay");
    expect(html).toContain("click to enter...");
    expect(html).toContain("profile-social-links");
    expect(html).toContain("<svg");
    expect(html).toContain("profile-audio-main");
    expect(html).toContain("profile-audio-transport");
    expect(html).toContain("profile-audio-timeline");
    expect(html).toContain("autoplay");
    expect(html).toContain('aria-label="Profile music player"');
    expect(html).toContain('src="https://cdn.example.com/audio/midnight-drive.mp3"');
    expect(html).toContain("Midnight Drive");
    expect(html).toContain("Demo Artist");
    expect(html).toContain('aria-label="Profile music volume"');
    expect(html).not.toContain("profile-more-content");
    expect(html).not.toContain("This section is hidden in the compact bio experience.");
    expect(html).not.toContain("guestbook-form");
    expect(html).not.toContain("profile-widgets");
  });

  it("renders a selected public background video as a viewport layer, separate from the profile card", () => {
    const videoId = "00000000-0000-4000-8000-000000000041";
    const profile = profileWith({
      appearance: { ...defaultAppearance, backgroundVideo: videoId },
    });
    const html = renderToStaticMarkup(createElement(ProfileCard, {
      profile, entryExperience: true,
      avatarSrc: "/media/avatar/bio-page-example/avatar.png",
    }));
    const viewportLayer = html.indexOf('class="profile-page-background"');
    const entryShell = html.indexOf('class="profile-entry-shell"');
    expect(viewportLayer).toBeGreaterThanOrEqual(0);
    expect(entryShell).toBeGreaterThan(viewportLayer);
    expect(html.slice(viewportLayer, entryShell)).toContain("profile-background-video--viewport");
    expect(html.slice(entryShell)).not.toContain("profile-background-video--viewport");
    expect(html).toContain('data-background-video="true"');
  });

  it("does not render a volume control or player for a hidden audio link", () => {
    const profile = profileWith({
      links: [
        { label: "Instagram", url: "https://instagram.com/example" },
        { label: "Hidden track — Demo Artist", url: "https://cdn.example.com/audio/hidden.mp3", hidden: true },
      ],
    });
    const html = renderToStaticMarkup(createElement(ProfileCard, { profile, entryExperience: true }));

    expect(html).not.toContain("profile-audio-player");
    expect(html).not.toContain("Profile music volume");
    expect(html).not.toContain("hidden.mp3");
  });

  it("renders Spotify as a normal provider link instead of an embedded third-party player", () => {
    const profile = profileWith({
      links: [{ label: "Spotify", url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC" }],
    });
    const html = renderToStaticMarkup(createElement(ProfileCard, { profile, entryExperience: true }));

    expect(html).toContain('href="https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"');
    expect(html).not.toContain("spotify-widget");
    expect(html).not.toContain("open.spotify.com/embed");
  });

  it("renders custom icon links and text-mode links without exposing saved extra sections", () => {
    const imageId = "00000000-0000-4000-8000-000000000011";
    const profile = profileWith({
      gallery: [{ id: imageId, alt: "Custom mark", width: 256, height: 256 }],
      links: [
        { label: "Custom", url: "https://example.com/custom", iconImage: imageId },
        { label: "Text only", url: "https://example.com/text", mode: "text" },
      ],
    });
    const html = renderToStaticMarkup(createElement(ProfileCard, {
      profile, entryExperience: true, galleryBase: "/media/gallery/bio-page-example",
    }));

    expect(html).toContain("/media/gallery/bio-page-example/" + imageId);
    expect(html).toContain("profile-text-links");
    expect(html).toContain("Text only");
    expect(html).not.toContain("profile-more-content");
    expect(html).not.toContain("profile-widgets");
  });

  it("keeps the existing Studio/profile renderer unchanged when entry experience is disabled", () => {
    const profile = profileWith();
    const html = renderToStaticMarkup(createElement(ProfileCard, { profile }));

    expect(html).not.toContain("profile-card--bio-experience");
    expect(html).not.toContain("profile-entry-overlay");
    expect(html).toContain("This section is hidden in the compact bio experience.");
    expect(html).toContain("profile-widgets");
  });
});
