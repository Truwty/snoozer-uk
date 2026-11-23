"use client";

import Link from "next/link";
import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { kofiProfileUrl } from "@/lib/kofi-link";
import { spotifyResource, spotifyLink } from "@/lib/spotify";
import { galleryMemoryWarning } from "@/lib/gallery-budget";
import { profileCorners, profileDensities, profileLayouts, themes, type DraftProfile, type ProfileContent } from "@/lib/profile";
import { linkAccents, linkAccentColours, linkAccentLabels } from "@/lib/link-accent";
import { studioTemplates } from "@/lib/studio-templates";
import { VisualSelect } from "./visual-select";
import { CopyLink } from "./copy-link";
import { SchedulePublication } from "./schedule-publication";
import type { PublicationSchedule } from "@/lib/publication-schedule";
import { Unpublish } from "./unpublish";
import { AppearanceTransfer } from "./appearance-transfer";
import { ActionMessage } from "./action-message";
import { ProfileCard } from "./profile-card";
import { EffectsEditor } from "./effects-editor";
import type { EffectTier } from "@/lib/profile-effects";
import { TextSectionsEditor } from "./text-sections-editor";
import { ProfileWidgetsEditor } from "./profile-widgets-editor";
import { useDraftEditor } from "./use-draft-editor";
import { usePointerReorder } from "./use-pointer-reorder";

type BuilderBlock = "text" | "callout" | "quote" | "link" | "guestbook" | "testimonials" | "poll" | "faq";

const blockLibrary: { id: BuilderBlock; label: string; description: string; symbol: string }[] = [
  { id: "text", label: "Text", description: "A heading and paragraph", symbol: "Aa" },
  { id: "callout", label: "Callout", description: "Highlight an update", symbol: "!" },
  { id: "quote", label: "Quote", description: "A quote with attribution", symbol: "“" },
  { id: "link", label: "Link", description: "A button to another page", symbol: "↗" },
  { id: "guestbook", label: "Guestbook", description: "Let visitors leave a message", symbol: "G" },
  { id: "testimonials", label: "Testimonials", description: "Show trusted feedback", symbol: "★" },
  { id: "poll", label: "Poll", description: "Ask visitors a question", symbol: "◉" },
  { id: "faq", label: "FAQ", description: "Answer common questions", symbol: "?" },
];

export function Editor({ draft, effectTier, linkLimit, galleryHref, initialTemplateId = "", avatar, settings, schedule }: { effectTier: EffectTier; schedule?: { current: PublicationSchedule | null; automatic: boolean; enabled: boolean }; avatar: ReactNode; settings: ReactNode; draft: DraftProfile; linkLimit: number; galleryHref: string; initialTemplateId?: string }) {
  const { saved, edits, edit, pending, conflict, message, commit, discardAndReload, travel, canUndo, canRedo } = useDraftEditor(draft);
  const tabs = ["Profile", "Design", "Links", "Sections", "Widgets", "Settings"] as const;
  const [tab, setTab] = useState<typeof tabs[number]>(initialTemplateId ? "Design" : "Profile");
  const [previewSize, setPreviewSize] = useState("wide");
  const [templateId, setTemplateId] = useState(initialTemplateId);
  const template = studioTemplates.find(({ id }) => id === templateId);
  const [kofiUrl, setKofiUrl] = useState("");
  const [kofiError, setKofiError] = useState(false);
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [spotifyError, setSpotifyError] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [dropActive, setDropActive] = useState(false);
  const linkLabels = useRef<Record<number, HTMLInputElement | null>>({});
  const addLink = useRef<HTMLButtonElement>(null);
  const content = edits?.content ?? saved;
  const removeAvatar = edits?.removeAvatar ?? false;
  const linkColours = linkAccentColours(content.appearance.accent);
  const galleryWarning = galleryMemoryWarning(saved.gallery);
  const { list: linkList, dropIndex: linkDropIndex, handle: linkHandle } = usePointerReorder(content.links, move);

  function set<K extends keyof ProfileContent>(field: K, value: ProfileContent[K]) {
    edit((current) => ({ ...current, content: { ...current.content, [field]: value } }));
  }

  function applyTemplate(includeSections: boolean) {
    if (!template) return;
    edit((current) => ({
      ...current,
      content: {
        ...current.content, theme: template.theme, appearance: { ...current.content.appearance, ...template.appearance },
        sections: includeSections && current.content.sections.length === 0 ? template.sections : current.content.sections,
      },
    }));
    setTemplateId("");
  }

  function setBackgroundImage(id?: string) {
    const appearance = { ...content.appearance };
    delete appearance.backgroundImage;
    set("appearance", id ? { ...content.appearance, backgroundImage: id } : appearance);
  }

  function move(from: number, to: number) {
    if (from === to || !content.links[from] || !content.links[to]) return;
    const reordered = [...content.links];
    reordered.splice(to, 0, ...reordered.splice(from, 1));
    set("links", reordered);
    setAnnouncement(`Moved link to position ${to + 1} of ${reordered.length}.`);
    focusLink(to);
  }

  function addKofiLink() {
    if (content.links.length >= linkLimit) return;
    const url = kofiProfileUrl(kofiUrl);
    if (!url) {
      setKofiError(true);
      return;
    }
    set("links", [...content.links, { label: "Support me", url }]);
    setKofiUrl("");
    setKofiError(false);
    setAnnouncement("Ko-fi support link added.");
    focusLink(content.links.length);
  }

  function addSpotifyLink() {
    if (content.links.length >= linkLimit) return;
    const resource = spotifyResource(spotifyUrl);
    const url = resource ? spotifyLink(resource) : null;
    if (!url || !resource) { setSpotifyError(true); return; }
    const name = resource.kind === "show" ? "Podcast" : resource.kind[0].toUpperCase() + resource.kind.slice(1);
    set("links", [...content.links, { label: "Spotify " + name, url }]);
    setSpotifyUrl("");
    setSpotifyError(false);
    setAnnouncement("Added a Spotify " + resource.kind + " link.");
    focusLink(content.links.length);
  }

  function focusLink(index: number) {
    window.requestAnimationFrame(() => (linkLabels.current[index] ?? addLink.current)?.focus());
  }

  function addBlock(kind: BuilderBlock) {
    if (kind === "text" || kind === "callout" || kind === "quote") {
      if (content.sections.length >= 6) {
        setTab("Sections");
        setAnnouncement("Your profile already has the maximum of six sections.");
        return;
      }
      const section = kind === "text"
        ? { heading: "New section", body: "Add your content here." }
        : kind === "callout"
          ? { kind: "callout" as const, heading: "Announcement", body: "Share an update with visitors." }
          : { kind: "quote" as const, heading: "Your name", body: "Add your quote here." };
      set("sections", [...content.sections, section]);
      setTab("Sections");
      setAnnouncement(kind[0].toUpperCase() + kind.slice(1) + " added to your page. Edit the new section in the Sections panel.");
      return;
    }

    if (kind === "link") {
      if (content.links.length >= linkLimit) {
        setTab("Links");
        setAnnouncement("Your current plan's link limit has been reached.");
        return;
      }
      set("links", [...content.links, { label: "New link", url: "https://snoozer.uk" }]);
      setTab("Links");
      setAnnouncement("A new link has been added. Update its label and destination in the Links panel.");
      focusLink(content.links.length);
      return;
    }

    const widgets = { ...content.widgets };
    if (widgets[kind].enabled) {
      setTab("Widgets");
      setAnnouncement((kind === "faq" ? "FAQ" : kind[0].toUpperCase() + kind.slice(1)) + " is already on your page. Its settings are open.");
      return;
    }
    if (kind === "guestbook") {
      widgets.guestbook = { ...widgets.guestbook, enabled: true };
    } else if (kind === "testimonials") {
      widgets.testimonials = {
        ...widgets.testimonials, enabled: true,
        items: widgets.testimonials.items.length ? widgets.testimonials.items : [
          { id: crypto.randomUUID(), quote: "Add your testimonial here.", author: "Your client", role: "" },
        ],
      };
    } else if (kind === "poll") {
      const options = [...widgets.poll.options];
      while (options.length < 2) options.push({ id: crypto.randomUUID(), label: "Option " + (options.length + 1) });
      widgets.poll = {
        ...widgets.poll, enabled: true, id: crypto.randomUUID(),
        question: widgets.poll.question.length >= 5 ? widgets.poll.question : "What would you like to see next?",
        options,
      };
    } else {
      widgets.faq = {
        ...widgets.faq, enabled: true,
        items: widgets.faq.items.length ? widgets.faq.items : [
          { id: crypto.randomUUID(), question: "Add your first question", answer: "Add your answer here." },
        ],
      };
    }
    set("widgets", widgets);
    setTab("Widgets");
    setAnnouncement((kind === "faq" ? "FAQ" : kind[0].toUpperCase() + kind.slice(1)) + " added to your page. You can customise it in the Widgets panel.");
  }

  function startBlockDrag(event: DragEvent<HTMLButtonElement>, kind: BuilderBlock) {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-snoozer-block", kind);
    event.dataTransfer.setData("text/plain", kind);
  }

  function dropBlock(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDropActive(false);
    const candidate = event.dataTransfer.getData("application/x-snoozer-block") || event.dataTransfer.getData("text/plain");
    const block = blockLibrary.find(({ id }) => id === candidate);
    if (block) addBlock(block.id);
  }

  return <div className="studio-workspace">
    <header className="editor-topbar">
      <div><strong>@{saved.username}</strong><p className="muted" aria-live="polite">{pending ? "Saving…" : edits ? "Unsaved changes" : saved.published_revision === null ? "Offline · Draft only" : saved.revision === saved.published_revision ? "Live · Up to date" : "Live · Unpublished changes"}</p></div>
      <div className="actions">
        {saved.published_revision !== null && <><Link className="button small" href={`/${saved.username}`}>View live page ↗</Link><CopyLink path={`/${saved.username}`} /></>}
        <div className="actions" aria-label="Editing history" role="group">
          <button type="button" className="button small" disabled={!canUndo} onClick={() => travel("undo")}>Undo edit</button>
          <button type="button" className="button small" disabled={!canRedo} onClick={() => travel("redo")}>Redo edit</button>
        </div>
        <button form="profile-editor" className="button" disabled={pending || conflict} name="intent" value="draft">Save draft</button>
        <button form="profile-editor" className="button primary" disabled={pending || conflict} name="intent" value="publish">Publish page</button>
      </div>
    </header>
    <div className="editor-grid">
      <aside className="editor-sidebar" aria-label="Studio tools">
        <section className="editor-navigation">
          <div className="editor-sidebar-heading">
            <p className="eyebrow">WORKSPACE</p>
            <h2>Edit profile</h2>
          </div>
      <div className="editor-tabs" role="tablist" aria-label="Profile editor">
        {tabs.map((name, index) => <button key={name} id={`editor-tab-${name}`} type="button" role="tab" aria-selected={tab === name}
          aria-controls={`editor-panel-${name}`} tabIndex={tab === name ? 0 : -1} onClick={() => setTab(name)}
          onKeyDown={(event) => {
            const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
            const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : direction ? (index + direction + tabs.length) % tabs.length : null;
            if (next !== null) { event.preventDefault(); setTab(tabs[next]); document.getElementById(`editor-tab-${tabs[next]}`)?.focus(); }
          }}>{name}</button>)}
      </div>
        </section>
        <section className="block-library" aria-labelledby="block-library-title">
          <div className="block-library-heading">
            <div><p className="eyebrow">BUILDER</p><h2 id="block-library-title">Add to page</h2></div>
            <span className="block-library-count">8 blocks</span>
          </div>
          <p className="muted block-library-intro">Drag a block onto the preview, or select it to add it instantly.</p>
          <div className="block-library-grid">
            {blockLibrary.map((block) => <button key={block.id} type="button" className="block-library-item" draggable
              onDragStart={(event) => startBlockDrag(event, block.id)} onClick={() => addBlock(block.id)}>
              <span className="block-library-symbol" aria-hidden="true">{block.symbol}</span>
              <span className="block-library-copy"><strong>{block.label}</strong><small>{block.description}</small></span>
              <span className="block-library-add" aria-hidden="true">+</span>
            </button>)}
          </div>
          </section>
      </aside>
      <div className="editor-column">
    <form id="profile-editor" className="editor-form stack" onInvalidCapture={(event) => {
      const panel = (event.target as HTMLElement).closest<HTMLElement>("[data-editor-panel]");
      if (panel) {
        setTab(panel.dataset.editorPanel as typeof tab);
        window.requestAnimationFrame(() => (event.target as HTMLElement).focus());
      }
    }} onSubmit={(event) => {
      event.preventDefault();
      const button = (event.nativeEvent as SubmitEvent).submitter;
      void commit(button instanceof HTMLButtonElement && button.value === "publish" ? "publish" : "draft");
    }}>

      <section role="tabpanel" aria-labelledby="editor-tab-Profile" id="editor-panel-Profile" data-editor-panel="Profile" hidden={tab !== "Profile"} className="editor-panel stack">
        <div className="avatar-panel"><h2>Avatar</h2>{avatar}</div>
      <fieldset className="stack">
        <legend className="section-title">Profile details</legend>
        <label>Display name<input name="display_name" maxLength={60} required value={content.display_name}
          onChange={(event) => set("display_name", event.target.value)} /></label>
        <label>Bio<textarea name="bio" maxLength={280} rows={4} value={content.bio}
          onChange={(event) => set("bio", event.target.value)} /></label>
      </fieldset>
      </section>
      <section role="tabpanel" aria-labelledby="editor-tab-Design" id="editor-panel-Design" data-editor-panel="Design" hidden={tab !== "Design"} className="editor-panel stack">
      <fieldset className="stack"><legend className="section-title">Appearance</legend>
        <VisualSelect label="Theme" onPick={(value) => { const theme = themes.find((item) => item === value); if (theme) set("theme", theme); }}><select name="theme" value={content.theme}
          onChange={(event) => set("theme", event.target.value as ProfileContent["theme"])}>
          {themes.map((theme) => <option key={theme} value={theme}>{theme[0].toUpperCase() + theme.slice(1)}</option>)}
        </select></VisualSelect>
        <VisualSelect label="Profile layout" onPick={(value) => { const layout = profileLayouts.find((item) => item === value); if (layout) set("appearance", { ...content.appearance, layout }); }}><select value={content.appearance.layout} onChange={(event) => {
          const layout = profileLayouts.find((value) => value === event.target.value);
          if (layout) set("appearance", { ...content.appearance, layout });
        }}>
          <option value="centred">Centred card</option>
          <option value="editorial">Editorial</option>
          <option value="portfolio">Portfolio grid</option>
        </select></VisualSelect>
        <label>Background entrance<select value={content.appearance.entrance} onChange={(event) => {
          const entrance = event.target.value;
          if (entrance === "none" || entrance === "fade" || entrance === "rise") set("appearance", { ...content.appearance, entrance });
        }}>
          <option value="none">None</option>
          <option value="fade">Fade in</option>
          <option value="rise">Soft rise</option>
        </select></label>
        <small className="muted">Decorative backgrounds animate once. Your visitor’s reduced-motion setting always takes priority.</small>
        <fieldset className="stack">
          <legend className="section-title">Profile background image</legend>
          <p className="muted">Choose an image from your gallery. A soft theme overlay keeps text readable, and the selected image won’t be repeated in the public gallery.</p>
          <div><Link className="button small" href={galleryHref}>Manage gallery images</Link></div>
          {!saved.gallery.length && <p className="muted">Upload an image in your gallery to use it here.</p>}
          <div className="background-image-options" role="group" aria-label="Profile background image">
            <button type="button" className="background-image-option background-image-none"
              aria-label="Use no background image" aria-pressed={!saved.gallery.some(({ id }) => id === content.appearance.backgroundImage)}
              onClick={() => setBackgroundImage()}>
              <span aria-hidden="true">Aa</span><span>No image</span>
            </button>
            {saved.gallery.map((image) => <button type="button" className="background-image-option"
              key={image.id} aria-label={`Use ${image.alt} as profile background`}
              aria-pressed={content.appearance.backgroundImage === image.id}
              onClick={() => setBackgroundImage(image.id)}>
              {/* The authenticated Studio route serves this already processed image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/studio/gallery/image/${image.id}`} alt="" width={image.width} height={image.height} loading="lazy" />
              <span>{image.alt}</span>
            </button>)}
          </div>
        </fieldset>
        <VisualSelect label="Card spacing" onPick={(value) => { const density = profileDensities.find((item) => item === value); if (density) set("appearance", { ...content.appearance, density }); }}><select value={content.appearance.density} onChange={(event) => {
          const density = profileDensities.find((value) => value === event.target.value);
          if (density) set("appearance", { ...content.appearance, density });
        }}>
          {profileDensities.map((value) => <option value={value} key={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
        </select></VisualSelect>
        <VisualSelect label="Card corners" onPick={(value) => { const corners = profileCorners.find((item) => item === value); if (corners) set("appearance", { ...content.appearance, corners }); }}><select value={content.appearance.corners} onChange={(event) => {
          const corners = profileCorners.find((value) => value === event.target.value);
          if (corners) set("appearance", { ...content.appearance, corners });
        }}>
          {profileCorners.map((value) => <option value={value} key={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
        </select></VisualSelect>
        <label>Link accent<select value={content.appearance.accent} aria-describedby="link-accent-contrast" onChange={(event) => {
          const accent = linkAccents.find((value) => value === event.target.value);
          if (accent) set("appearance", { ...content.appearance, accent });
        }}>
          {linkAccents.map((accent) => <option value={accent} key={accent}>{linkAccentLabels[accent]}</option>)}
        </select></label>
        <p id="link-accent-contrast" className="muted" aria-live="polite">
          {linkColours ? "Link text contrast " + (Math.floor(linkColours.ratio * 10) / 10).toFixed(1) + " to 1."
            : "Links use your theme colours."}
        </p>
      </fieldset>
      <EffectsEditor tier={effectTier} value={content.appearance.effects} onChange={(effects) => set("appearance", { ...content.appearance, effects })} />
      <fieldset className="stack">
        <legend className="section-title">Studio templates</legend>
        <label>Preview a template
          <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            <option value="">Show my draft</option>
            {studioTemplates.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        {template && <>
          <p className="muted">{template.description} The preview is private.</p>
          <div className="actions">
            <button type="button" className="button small" onClick={() => applyTemplate(false)}>Apply template colours</button>
            {content.sections.length === 0 && <button type="button" className="button small"
              onClick={() => applyTemplate(true)}>Apply with starter sections</button>}
          </div>
        </>}
      </fieldset>
      <AppearanceTransfer settings={content} onApply={(settings) => {
        edit((current) => ({ ...current, content: { ...current.content, ...settings,
          appearance: { ...settings.appearance, ...(current.content.appearance.backgroundImage ? { backgroundImage: current.content.appearance.backgroundImage } : {}) } } }));
        setTemplateId("");
      }} />
      </section>
      <section role="tabpanel" aria-labelledby="editor-tab-Sections" id="editor-panel-Sections" data-editor-panel="Sections" hidden={tab !== "Sections"} className="editor-panel stack">
        <TextSectionsEditor sections={content.sections} onChange={(sections) => set("sections", sections)} />
      </section>
      <section role="tabpanel" aria-labelledby="editor-tab-Widgets" id="editor-panel-Widgets" data-editor-panel="Widgets" hidden={tab !== "Widgets"} className="editor-panel stack">
        <ProfileWidgetsEditor value={content.widgets} onChange={(widgets) => set("widgets", widgets)} />
        <Link className="button small" href={"/studio/widgets/guestbook?profile=" + encodeURIComponent(saved.profile_id)}>Moderate Guestbook messages</Link>
      </section>
      <section role="tabpanel" aria-labelledby="editor-tab-Links" id="editor-panel-Links" data-editor-panel="Links" hidden={tab !== "Links"} className="editor-panel stack">
      <fieldset className="stack" ref={linkList}>
        <legend className="section-title">Links <small>{content.links.length}/{linkLimit}</small></legend>
        <p className="sr-only" aria-live="polite">{announcement}</p>
        {content.links.length > linkLimit && <p>Remove links until you reach your current allowance before saving link edits or publishing.</p>}
        {content.links.map((item, index) => <div className="link-editor link-row" key={index} data-reorder-index={index}
          data-drop-target={linkDropIndex === index || undefined}>
          {content.links.length > 1 && <span className="reorder-handle" aria-hidden="true" {...linkHandle}>Drag to move</span>}
          <label>Link {index + 1} label<input required maxLength={80} value={item.label}
            ref={(input) => { linkLabels.current[index] = input; }}
            onChange={(event) => set("links", content.links.map((entry, i) => i === index ? { ...entry, label: event.target.value } : entry))} /></label>
          <label>Link {index + 1} URL<input required type="url" maxLength={2048} placeholder="https://"
            value={item.url} onChange={(event) => set("links", content.links.map((entry, i) => i === index ? { ...entry, url: event.target.value } : entry))} /></label>
          <details className="row-menu" onClick={(event) => { if (event.target instanceof Element && event.target.closest("button")) event.currentTarget.open = false; }}><summary aria-label={`Actions for link ${index + 1}`}>Actions</summary><div className="actions">
            <button type="button" className="button small" disabled={index === 0} aria-label={`Move up (link ${index + 1})`} onClick={() => move(index, index - 1)}>Move up</button>
            <button type="button" className="button small" disabled={index === content.links.length - 1} aria-label={`Move down (link ${index + 1})`} onClick={() => move(index, index + 1)}>Move down</button>
            <button type="button" className="button small" aria-label={`Remove link ${index + 1}`} onClick={() => {
              set("links", content.links.filter((_, i) => i !== index));
              setAnnouncement(`Removed link ${index + 1}.`);
              focusLink(Math.min(index, content.links.length - 2));
            }}>Remove</button>
          </div></details>
        </div>)}
        <button className="button" type="button" ref={addLink} disabled={content.links.length >= linkLimit}
          onClick={() => {
            set("links", [...content.links, { label: "", url: "" }]);
            focusLink(content.links.length);
          }}>Add link</button>
        {content.links.length < linkLimit && <details>
          <summary>Add Spotify music or playlist</summary>
          <div className="stack">
            <p className="muted">Add an official Spotify track, album, playlist, artist or podcast link. No Spotify account connection is required. The player appears automatically on the published profile.</p>
            <label>Spotify share URL<input type="url" maxLength={2048} value={spotifyUrl}
              placeholder="https://open.spotify.com/playlist/…"
              aria-invalid={spotifyError} aria-describedby={spotifyError ? "spotify-url-error" : undefined}
              onChange={(event) => { setSpotifyUrl(event.target.value); setSpotifyError(false); }}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSpotifyLink(); } }} /></label>
            {spotifyError && <p id="spotify-url-error" role="alert">Enter a recognised open.spotify.com track, album, playlist, artist, show or episode link.</p>}
            <button type="button" className="button small" onClick={addSpotifyLink}>Add Spotify link</button>
          </div>
        </details>}
        {content.links.length < linkLimit && <details>
          <summary>Add Ko-fi support link</summary>
          <div className="stack">
            <label>Ko-fi profile URL<input type="text" inputMode="url" maxLength={100}
              value={kofiUrl} placeholder="https://ko-fi.com/yourname"
              aria-invalid={kofiError} aria-describedby={kofiError ? "kofi-url-error" : undefined}
              onChange={(event) => { setKofiUrl(event.target.value); setKofiError(false); }}
              onKeyDown={(event) => {
                if (event.key === "Enter") { event.preventDefault(); addKofiLink(); }
              }} /></label>
            {kofiError && <p id="kofi-url-error" role="alert">Enter your full Ko-fi profile address.</p>}
            <button type="button" className="button small" onClick={addKofiLink}>Add support link</button>
          </div>
        </details>}
      </fieldset>
      </section>

      {conflict && !pending ? <div className="stack">
        <p className="message error" role="alert">Your draft changed elsewhere. Your unsaved edits are still here.</p>
        <details>
          <summary>Copy unsaved edits</summary>
          <label>Unsaved profile content
            <textarea readOnly rows={6} value={JSON.stringify({
              display_name: content.display_name, bio: content.bio, theme: content.theme, indexable: content.indexable,
              links: content.links, sections: content.sections, appearance: content.appearance, removeAvatar,
            }, null, 2)} />
          </label>
        </details>
        <div><button className="button" type="button" onClick={() => void discardAndReload()}>Discard local edits and load saved draft</button></div>
      </div> : null}
      {pending ? <p className="message" role="status">Saving…</p> : <>
        {edits && !conflict && message.status !== "error"
          ? <p className="message" role="status">{removeAvatar ? "Save manually to remove the avatar." : "Unsaved changes"}</p>
          : <ActionMessage state={message} />}
      </>}
    </form>
      <section role="tabpanel" aria-labelledby="editor-tab-Settings" id="editor-panel-Settings" data-editor-panel="Settings" hidden={tab !== "Settings"} className="editor-settings editor-panel stack">
        <fieldset className="stack"><legend className="section-title">Search and sharing</legend>
          <p className="muted">Draft custom metadata on any plan. Publishing overrides requires Plus or higher. Leave these blank to use your display name and bio. Search engines and social sites may cache older previews.</p>
          <label>SEO title<input form="profile-editor" name="seo_title" maxLength={70} value={content.seo.title} onChange={(event) => set("seo", { ...content.seo, title: event.target.value })} /></label>
          <label>SEO description<textarea form="profile-editor" name="seo_description" rows={3} maxLength={160} value={content.seo.description} onChange={(event) => set("seo", { ...content.seo, description: event.target.value })} /></label>
          <div className="stack" aria-label="Metadata preview"><strong>{content.seo.title || content.display_name}</strong><p>{content.seo.description || content.bio || `Links from @${saved.username} on Snoozer.`}</p></div>
        </fieldset>
        <label className="check"><input type="checkbox" form="profile-editor" name="indexable" checked={content.indexable}
          onChange={(event) => set("indexable", event.target.checked)} /> Allow search engines to index my published page</label>
        {saved.avatar && <label className="check"><input type="checkbox" form="profile-editor" name="remove_avatar" checked={removeAvatar} disabled={pending}
          onChange={(event) => {
            const checked = event.target.checked;
            edit((current) => ({ ...current, removeAvatar: checked }));
          }} /> Remove avatar on next manual save</label>}

      {saved.published_revision !== null && <Unpublish profileId={saved.profile_id} revision={saved.revision} />}
      {schedule ? <SchedulePublication profileId={saved.profile_id} revision={saved.revision} current={schedule.current} automatic={schedule.automatic} enabled={schedule.enabled} captureDisabled={Boolean(edits) || pending || conflict} /> : <p role="alert">Scheduled publishing is unavailable. Reload to try again.</p>}
      {settings}
      </section>
    </div>
    <aside className="preview stack">
      <div className="actions preview-controls">
        <p className="eyebrow">{template ? "TEMPLATE PREVIEW" : "LIVE PREVIEW"}</p>
        <label>Preview width
          <select value={previewSize} onChange={(event) => setPreviewSize(event.target.value)}>
            <option value="wide">Wide page</option>
            <option value="phone">Phone (375 px)</option>
            <option value="narrow">Narrow phone (320 px)</option>
          </select>
        </label>
      </div>
      {galleryWarning && <section className="panel stack gallery-budget" aria-labelledby="gallery-budget-title">
        <h2 id="gallery-budget-title">Gallery may use more memory on phones</h2>
        <p>Estimated image memory after decoding is {galleryWarning} MiB. Use fewer or smaller images to reduce it.</p>
        <div><Link className="button small" href={galleryHref}>Manage gallery images</Link></div>
      </section>}
      <div className={"preview-card preview-" + previewSize + (dropActive ? " is-drop-active" : "")}
        onDragOver={(event) => {
          if (Array.from(event.dataTransfer.types).includes("application/x-snoozer-block")) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setDropActive(true);
          }
        }}
        onDragLeave={(event) => {
          if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropActive(false);
        }}
        onDrop={dropBlock} data-drop-active={dropActive || undefined}>
        <ProfileCard preview galleryBase="/studio/gallery/image" profile={template ? {
          ...saved, ...content, theme: template.theme, appearance: { ...content.appearance, ...template.appearance },
          sections: content.sections.length ? content.sections : template.sections,
        } : { ...saved, ...content }}
          avatarSrc={saved.avatar && !removeAvatar ? `/studio/avatar/${saved.avatar}` : undefined} />
        {dropActive && <div className="preview-drop-overlay" aria-hidden="true"><span>Drop to add to your page</span></div>}
      </div>
      <p className="preview-drop-help">Tip: drag any block from <strong>Add to page</strong> and drop it onto this preview. You can also use the <strong>+</strong> buttons.</p>
    </aside>
  </div></div>;
}
