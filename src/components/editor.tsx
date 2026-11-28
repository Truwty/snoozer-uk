"use client";

import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { StudioAudioLibrary } from "@/components/studio-audio-library";
import { StudioBackgroundUploader } from "@/components/studio-background-uploader";
import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { galleryIncoming, galleryMaxBytes, galleryTypes, type GalleryItem } from "@/lib/gallery";
import { startGalleryUpload, finishGalleryUpload, discardGalleryUpload } from "@/app/studio/gallery/actions";
import { supabaseConfig } from "@/lib/env";
import { safeLink } from "@/lib/safe-link";
import { profileCorners, profileDensities, profileEntrances, profileLayouts, themes, type DraftProfile, type ProfileContent } from "@/lib/profile";
import type { EffectTier } from "@/lib/profile-effects";
import { makeProfileBlock, type ProfileBlock } from "@/lib/profile-blocks";
import { linkAccents, linkAccentLabels } from "@/lib/link-accent";
import { filterSocialProviders, socialProviderCategories, socialProviderForUrl, type SocialProvider, type SocialProviderCategory } from "@/lib/social-providers";
import { studioTemplates } from "@/lib/studio-templates";
import { CopyLink } from "./copy-link";
import { SchedulePublication } from "./schedule-publication";
import type { PublicationSchedule } from "@/lib/publication-schedule";
import { Unpublish } from "./unpublish";
import { ActionMessage } from "./action-message";
import { ProfileCard } from "./profile-card";
import { EffectsEditor } from "./effects-editor";
import { ImageHostPurchase } from "@/components/image-host-purchase";
import { SocialProviderIcon } from "./social-provider-icon";
import { TextSectionsEditor } from "./text-sections-editor";
import { ProfileBlocksEditor } from "./profile-blocks-editor";
import { ProfileWidgetsEditor } from "./profile-widgets-editor";
import { useDraftEditor } from "./use-draft-editor";
import { usePointerReorder } from "./use-pointer-reorder";
import { moveProfilePageElement, normalizeProfilePageLayout, remapProfileSectionPositions, type ProfilePageLayoutItem } from "@/lib/profile-layout";

type BuilderBlock = "text" | "callout" | "quote" | "link" | "guestbook" | "testimonials" | "poll" | "faq"
  | ProfileBlock["type"] | "block-callout" | "block-quote";

const blockLibrary: { id: BuilderBlock; label: string; description: string; symbol: string }[] = [
  { id: "text", label: "Text", description: "A heading and paragraph", symbol: "Aa" },
  { id: "callout", label: "Callout", description: "Highlight an update", symbol: "!" },
  { id: "quote", label: "Quote", description: "A quote with attribution", symbol: "“" },
  { id: "link", label: "Link", description: "A button to another page", symbol: "↗" },
  { id: "guestbook", label: "Guestbook", description: "Let visitors leave a message", symbol: "G" },
  { id: "testimonials", label: "Testimonials", description: "Show trusted feedback", symbol: "★" },
  { id: "poll", label: "Poll", description: "Ask visitors a question", symbol: "◉" },
  { id: "faq", label: "FAQ", description: "Answer common questions", symbol: "?" },
  { id: "heading", label: "Heading", description: "Add a page title", symbol: "H" },
  { id: "about", label: "About", description: "Tell your story", symbol: "Aa" },
  { id: "project", label: "Project", description: "Feature your work", symbol: "↗" },
  { id: "skills", label: "Skills", description: "Show your toolkit", symbol: "✳" },
  { id: "cta", label: "Call to action", description: "Add a prominent button", symbol: "→" },
  { id: "divider", label: "Divider", description: "Separate page content", symbol: "—" },
  { id: "countdown", label: "Countdown", description: "Count down to a date", symbol: "◷" },
  { id: "stats", label: "Statistics", description: "Show key numbers", symbol: "#" },
  { id: "block-callout", label: "Callout block", description: "Add a styled native callout", symbol: "!" },
  { id: "block-quote", label: "Quote block", description: "Add a styled quotation", symbol: "“" },
];

export function Editor({ draft, effectTier, linkLimit, imageHostOffer = null, imageHostActive = false, initialTemplateId = "", initialTab = "Profile", panelOnly = false, avatar, settings, schedule }: { effectTier: EffectTier; schedule?: { current: PublicationSchedule | null; automatic: boolean; enabled: boolean }; avatar: ReactNode; settings: ReactNode; draft: DraftProfile; linkLimit: number; imageHostOffer?: { price_id:string; currency:"eur"; unit_amount:499 } | null; imageHostActive?: boolean; initialTemplateId?: string; initialTab?: "Profile" | "Design" | "Links" | "Sections" | "Widgets" | "Settings"; panelOnly?: boolean }) {
  const { saved, edits, edit, pending, conflict, message, commit, discardAndReload, refreshSaved, travel, canUndo, canRedo } = useDraftEditor(draft);
  const tabs = ["Profile", "Design", "Links", "Sections", "Blocks", "Widgets", "Settings"] as const;
  const [tab, setTab] = useState<typeof tabs[number]>(initialTemplateId ? "Design" : initialTab);
  const [previewSize, setPreviewSize] = useState("wide");
  const [templateId, setTemplateId] = useState(initialTemplateId);
  const template = studioTemplates.find(({ id }) => id === templateId);
  const [announcement, setAnnouncement] = useState("");
  const [providerQuery, setProviderQuery] = useState("");
  const [providerCategory, setProviderCategory] = useState<SocialProviderCategory>("All");
  const [customUrlOpen, setCustomUrlOpen] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [customSocialMode, setCustomSocialMode] = useState<"icon" | "text">("icon");
  const [customIconFile, setCustomIconFile] = useState<File | null>(null);
  const [customIconBusy, setCustomIconBusy] = useState(false);
  const [customUrlError, setCustomUrlError] = useState("");
  const customIconInput = useRef<HTMLInputElement>(null);
  const [dropActive, setDropActive] = useState(false);
  const [uploadedBackgroundImages, setUploadedBackgroundImages] = useState<GalleryItem[]>([]);
  const pointerBlockDrag = useRef<{ pointerId: number; kind: BuilderBlock; x: number; y: number; active: boolean } | null>(null);
  const suppressBlockClick = useRef(false);
  const linkLabels = useRef<Record<number, HTMLInputElement | null>>({});
  const addLink = useRef<HTMLButtonElement>(null);
  const content = edits?.content ?? saved;
  const removeAvatar = edits?.removeAvatar ?? false;
  const customColours = content.appearance.colors ?? {};
  const previewGallery = [...saved.gallery, ...uploadedBackgroundImages.filter((image) => !saved.gallery.some((savedImage) => savedImage.id === image.id))];
  const pageLayout = normalizeProfilePageLayout(content.pageLayout, { ...content, gallery: saved.gallery });
  const { list: linkList, dropIndex: linkDropIndex, handle: linkHandle } = usePointerReorder(content.links, move);

  function set<K extends keyof ProfileContent>(field: K, value: ProfileContent[K]) {
    edit((current) => {
      const nextContent = { ...current.content, [field]: value };
      const currentLayout = normalizeProfilePageLayout(current.content.pageLayout, {
        ...current.content, gallery: saved.gallery,
      });
      const nextLayout = field === "sections"
        ? remapProfileSectionPositions(currentLayout, current.content.sections,
            value as ProfileContent["sections"], { ...nextContent, gallery: saved.gallery })
        : field === "pageLayout" ? value : currentLayout;
      return {
        ...current,
        content: {
          ...nextContent,
          pageLayout: normalizeProfilePageLayout(nextLayout, { ...nextContent, gallery: saved.gallery }),
        },
      };
    });
  }

  function applyTemplate(includeSections: boolean) {
    if (!template) return;
    edit((current) => {
      const nextContent = {
        ...current.content,
        theme: template.theme,
        appearance: {
          ...current.content.appearance,
          ...template.appearance,
          ...(current.content.appearance.backgroundImage ? { backgroundImage: current.content.appearance.backgroundImage } : {}),
          ...(current.content.appearance.backgroundVideo ? { backgroundVideo: current.content.appearance.backgroundVideo } : {}),
          ...(current.content.appearance.effects ? { effects: current.content.appearance.effects } : {}),
        },
        sections: includeSections && current.content.sections.length === 0 ? template.sections : current.content.sections,
      };
      return {
        ...current,
        content: {
          ...nextContent,
          pageLayout: normalizeProfilePageLayout(current.content.pageLayout, { ...nextContent, gallery: saved.gallery }),
        },
      };
    });
    setTemplateId("");
  }

  function setBackgroundImage(id?: string, revisionOverride?: number) {
    edit((current) => {
      const appearance = { ...current.content.appearance };
      delete appearance.backgroundImage;
      if (id) {
        delete appearance.backgroundVideo;
        appearance.backgroundImage = id;
      }
      return {
        ...current,
        ...(typeof revisionOverride === "number" ? { revision: revisionOverride } : {}),
        content: { ...current.content, appearance },
      };
    });
  }

  function setBackgroundVideo(id?: string) {
    const appearance = { ...content.appearance };
    delete appearance.backgroundVideo;
    if (id) {
      delete appearance.backgroundImage;
      appearance.backgroundVideo = id;
    }
    set("appearance", appearance);
  }

  function move(from: number, to: number) {
    if (from === to || !content.links[from] || !content.links[to]) return;
    const reordered = [...content.links];
    reordered.splice(to, 0, ...reordered.splice(from, 1));
    set("links", reordered);
    setAnnouncement(`Moved link to position ${to + 1} of ${reordered.length}.`);
    focusLink(to);
  }

  async function addCustomUrl() {
    if (content.links.length >= linkLimit) {
      setCustomUrlError("Your current plan has reached its link limit.");
      return;
    }
    let parsed: URL;
    try { parsed = new URL(customUrl.trim()); } catch {
      setCustomUrlError("Enter a valid URL.");
      return;
    }
    if (!["http:", "https:"].includes(parsed.protocol) || !safeLink(parsed.href)) {
      setCustomUrlError("Use a public HTTP or HTTPS address.");
      return;
    }
    setCustomIconBusy(true);
    setCustomUrlError("");
    let uploadedId: string | undefined;
    let stagedId: string | undefined;
    try {
      if (customSocialMode === "icon" && customIconFile) {
        if (customIconFile.size < 1 || customIconFile.size > galleryMaxBytes || !galleryTypes.includes(customIconFile.type)) {
          setCustomUrlError("Choose a JPEG, PNG or WebP icon up to 4 MB.");
          return;
        }
        const started = await startGalleryUpload(saved.profile_id, saved.revision, "Custom social icon — " + parsed.hostname);
        if ("error" in started || !started.id || !started.path || !started.token) {
          setCustomUrlError(started.error ?? "Could not prepare the icon upload.");
          return;
        }
        stagedId = started.id;
        const config = supabaseConfig();
        const browser = createBrowserClient(config.url, config.key);
        const { error } = await browser.storage.from(galleryIncoming)
          .uploadToSignedUrl(started.path, started.token, customIconFile, { contentType: customIconFile.type, upsert: false });
        if (error) {
          await discardGalleryUpload(saved.profile_id, saved.revision, started.id);
          setCustomUrlError("The icon could not be uploaded. Try again.");
          return;
        }
        const completed = await finishGalleryUpload(saved.profile_id, saved.revision, started.id);
        if ("error" in completed) {
          await discardGalleryUpload(saved.profile_id, saved.revision, started.id);
          setCustomUrlError(completed.error ?? "The icon could not be saved.");
          return;
        }
        uploadedId = started.id;
        await refreshSaved();
      }
      const label = parsed.hostname.replace(/^www\./i, "").slice(0, 80) || "Custom URL";
      const newLink = {
        label, url: parsed.href, hidden: false, mode: customSocialMode,
        ...(uploadedId ? { iconImage: uploadedId } : {}),
      };
      if (uploadedId) {
        const latest = await refreshSaved();
        edit((current) => ({
          ...current,
          revision: latest.revision,
          content: { ...current.content, links: [...current.content.links, newLink] },
        }));
      } else {
        set("links", [...content.links, newLink]);
      }
      setCustomUrlOpen(false);
      setCustomUrl("");
      setCustomIconFile(null);
      if (customIconInput.current) customIconInput.current.value = "";
      setAnnouncement("Custom URL added. Save or publish your profile to make it visible.");
    } catch (reason) {
      if (stagedId && !uploadedId) await discardGalleryUpload(saved.profile_id, saved.revision, stagedId).catch(() => undefined);
      setCustomUrlError(reason instanceof Error ? reason.message : "The custom URL could not be added.");
    } finally {
      setCustomIconBusy(false);
    }
  }

  function addSocialProvider(provider: SocialProvider) {
    if (content.links.length >= linkLimit) {
      setAnnouncement("Your current plan's link limit has been reached.");
      return;
    }
    const index = content.links.length;
    set("links", [...content.links, { label: provider.label, url: provider.baseUrl, hidden: true }]);
    setAnnouncement(provider.label + " link added as hidden. Enter your profile or invite address, then switch Visible on when it is ready.");
    focusLink(index);
  }

  function focusLink(index: number) {
    window.requestAnimationFrame(() => (linkLabels.current[index] ?? addLink.current)?.focus());
  }

  function addBlock(kind: BuilderBlock) {
    const nativeType: ProfileBlock["type"] | null = kind === "block-callout" ? "callout"
      : kind === "block-quote" ? "quote"
      : ["heading", "about", "project", "skills", "cta", "divider", "countdown", "stats"].includes(kind)
        ? kind as ProfileBlock["type"] : null;
    if (nativeType) {
      if (content.blocks.length >= 32) {
        setTab("Blocks");
        setAnnouncement("Your page already has the maximum of 32 custom blocks.");
        return;
      }
      const block = makeProfileBlock(nativeType);
      set("blocks", [...content.blocks, block]);
      setTab("Blocks");
      setAnnouncement(block.type[0].toUpperCase() + block.type.slice(1) + " block added as hidden. Edit it in the Blocks panel, then make it visible when the content is ready.");
      return;
    }

    if (kind === "text" || kind === "callout" || kind === "quote") {
      if (content.sections.length >= 6) {
        setTab("Sections");
        setAnnouncement("Your profile already has the maximum of six sections.");
        return;
      }
      const section = kind === "text"
        ? { heading: "New section", body: "Add your content here.", hidden: true }
        : kind === "callout"
          ? { kind: "callout" as const, heading: "Announcement", body: "Share an update with visitors.", hidden: true }
          : { kind: "quote" as const, heading: "Your name", body: "Add your quote here.", hidden: true };
      set("sections", [...content.sections, section]);
      setTab("Sections");
      setAnnouncement(kind[0].toUpperCase() + kind.slice(1) + " added as hidden. Edit the sample content in the Sections panel, then make it visible when it is ready.");
      return;
    }

    if (kind === "link") {
      if (content.links.length >= linkLimit) {
        setTab("Links");
        setAnnouncement("Your current plan's link limit has been reached.");
        return;
      }
      set("links", [...content.links, { label: "New link", url: "https://snoozer.uk", hidden: true }]);
      setTab("Links");
      setAnnouncement("A new link has been added as hidden. Update its label and destination, then switch Visible on when it is ready.");
      focusLink(content.links.length);
      return;
    }

    if (kind !== "guestbook" && kind !== "testimonials" && kind !== "poll" && kind !== "faq") return;
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
          { id: crypto.randomUUID(), quote: "Add your testimonial here.", author: "Add author name", role: "" },
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

  function startBlockPointerDrag(event: ReactPointerEvent<HTMLButtonElement>, kind: BuilderBlock) {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    pointerBlockDrag.current = {
      pointerId: event.pointerId, kind, x: event.clientX, y: event.clientY, active: false,
    };
  }

  function trackBlockPointerDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = pointerBlockDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8) return;
    drag.active = true;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    setDropActive(Boolean(target?.closest(".preview-card, .preview")));
  }

  function finishBlockPointerDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = pointerBlockDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const shouldAdd = drag.active && Boolean(target?.closest(".preview-card, .preview"));
    pointerBlockDrag.current = null;
    setDropActive(false);
    if (!shouldAdd) return;
    event.preventDefault();
    suppressBlockClick.current = true;
    addBlock(drag.kind);
    window.setTimeout(() => { suppressBlockClick.current = false; }, 0);
  }

  function cancelBlockPointerDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerBlockDrag.current?.pointerId !== event.pointerId) return;
    pointerBlockDrag.current = null;
    setDropActive(false);
  }

  return <div className="studio-workspace" onPointerMove={trackBlockPointerDrag} onPointerUp={finishBlockPointerDrag} onPointerCancel={cancelBlockPointerDrag}>
    <header className="editor-topbar">
      <div><strong>@{saved.username}</strong><p className="muted" aria-live="polite">{pending ? "Saving…" : edits ? "Unsaved changes" : saved.published_revision === null ? "Offline · Draft only" : saved.revision === saved.published_revision ? "Live · Up to date" : "Live · Unpublished changes"}</p><p className="editor-publish-hint">Drafts save privately. Publish page to update the profile visitors see.</p></div>
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
    <div className={"editor-grid" + (panelOnly ? " panel-only" : "")}>
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
            <span className="block-library-count">{blockLibrary.length} blocks</span>
          </div>
          <p className="muted block-library-intro">Drag a block onto the preview, or select it to add it instantly.</p>
          <div className="block-library-grid">
            {blockLibrary.map((block) => <button key={block.id} type="button" className="block-library-item"
              aria-describedby={`block-description-${block.id}`}
              onPointerDown={(event) => startBlockPointerDrag(event, block.id)}
              onClick={() => {
                if (suppressBlockClick.current) { suppressBlockClick.current = false; return; }
                addBlock(block.id);
              }}>
              <span className="block-library-symbol" aria-hidden="true">{block.symbol}</span>
              <span className="block-library-copy"><strong>{block.label}</strong><small id={`block-description-${block.id}`}>{block.description}</small></span>
              <span className="block-library-add" aria-hidden="true">+</span>
            </button>)}
          </div>
          <p className="sr-only" aria-live="polite">{announcement}</p>
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
        {!panelOnly && <div className="avatar-panel"><h2>Avatar</h2>{avatar}</div>}
      <fieldset className="stack">
        <legend className="section-title">Profile details</legend>
        <label>Display name<input name="display_name" maxLength={60} required value={content.display_name}
          onChange={(event) => set("display_name", event.target.value)} /></label>
        <label>Bio<textarea name="bio" maxLength={280} rows={4} value={content.bio}
          onChange={(event) => set("bio", event.target.value)} /></label>
      </fieldset>
      </section>
      <section role="tabpanel" aria-labelledby="editor-tab-Design" id="editor-panel-Design" data-editor-panel="Design" hidden={tab !== "Design"} className="editor-panel stack">
        <fieldset className="stack studio-reference-customization studio-profile-style-controls">
          <legend className="section-title">Profile Style</legend>
          <div className="studio-reference-customization-grid">
            <label>Theme
              <select aria-label="Theme" value={content.theme}
                onChange={(event)=>set("theme",event.target.value as typeof themes[number])}>
                {themes.map((theme)=><option key={theme} value={theme}>{theme[0].toUpperCase()+theme.slice(1)}</option>)}
              </select>
            </label>
            <label>Profile layout
              <select aria-label="Profile layout" value={content.appearance.layout}
                onChange={(event)=>set("appearance",{...content.appearance,layout:event.target.value as typeof profileLayouts[number]})}>
                {profileLayouts.map((layout)=><option key={layout} value={layout}>{layout==="centred"?"Centred card":layout[0].toUpperCase()+layout.slice(1)}</option>)}
              </select>
            </label>
            <label>Profile density
              <select aria-label="Profile density" value={content.appearance.density}
                onChange={(event)=>set("appearance",{...content.appearance,density:event.target.value as typeof profileDensities[number]})}>
                {profileDensities.map((density)=><option key={density} value={density}>{density[0].toUpperCase()+density.slice(1)}</option>)}
              </select>
            </label>
            <label>Profile corners
              <select aria-label="Profile corners" value={content.appearance.corners}
                onChange={(event)=>set("appearance",{...content.appearance,corners:event.target.value as typeof profileCorners[number]})}>
                {profileCorners.map((corners)=><option key={corners} value={corners}>{corners[0].toUpperCase()+corners.slice(1)}</option>)}
              </select>
            </label>
            <label>Background entrance
              <select aria-label="Background entrance" value={content.appearance.entrance}
                onChange={(event)=>set("appearance",{...content.appearance,entrance:event.target.value as typeof profileEntrances[number]})}>
                {profileEntrances.map((entrance)=><option key={entrance} value={entrance}>{entrance==="none"?"None":entrance[0].toUpperCase()+entrance.slice(1)}</option>)}
              </select>
            </label>
            <label>Profile font
              <select aria-label="Profile font" value={content.appearance.font??"system"}
                onChange={(event)=>set("appearance",{...content.appearance,font:event.target.value as NonNullable<ProfileContent["appearance"]["font"]>})}>
                <option value="system">System</option>
                <option value="sans">Sans serif</option>
                <option value="serif">Serif</option>
                <option value="mono">Monospace</option>
              </select>
            </label>
            <label>Link colour
              <select aria-label="Link colour" value={content.appearance.accent}
                onChange={(event)=>set("appearance",{...content.appearance,accent:event.target.value as ProfileContent["appearance"]["accent"]})}>
                {linkAccents.map((accent)=><option key={accent} value={accent}>{linkAccentLabels[accent]}</option>)}
              </select>
            </label>
          </div>
        </fieldset>
        <section className="studio-assets-uploader stack" aria-labelledby="studio-assets-title">
          <div className="studio-assets-heading">
            <div><p className="eyebrow">PROFILE ASSETS</p><h2 id="studio-assets-title">Assets Uploader</h2>
              <p className="muted">Upload and manage the four assets used by your published profile.</p></div>
            <Link className="button small" href="/studio/image-host">Open Image Host ↗</Link>
          </div>
          {effectTier === "free" && <div className="studio-assets-premium">
            <div><strong>Make your page stand out</strong><p>Unlock more profile effects and media capacity with Snoozer Premium.</p></div>
            <Link className="button small primary" href="/studio/plan">Explore Premium ↗</Link>
          </div>}
          <div className="studio-assets-grid">
            <article className="studio-asset-card studio-asset-background">
              <div className="studio-asset-card-top"><span className="studio-asset-icon" aria-hidden="true">▧</span><span className="studio-asset-kind">01 / BACKGROUND</span></div>
              <h3>Background</h3>
              <p className="muted">Upload a still image or a silent looping video clip. Use the buttons to choose files directly—there is no separate image drop zone.</p>
              <StudioBackgroundUploader
                profileId={saved.profile_id}
                revision={saved.revision}
                gallery={previewGallery}
                backgroundImage={content.appearance.backgroundImage}
                backgroundVideo={content.appearance.backgroundVideo}
                onSelectImage={setBackgroundImage}
                onSelectVideo={setBackgroundVideo}
                onImageAdded={async (image) => {
                  setUploadedBackgroundImages((current) =>
                    [...current.filter((item) => item.id !== image.id), image]);
                  // Image processing increments the profile revision; refresh before autosaving its background selection.
                  const latest = await refreshSaved();
                  return latest.revision;
                }}
              />
            </article>
            <article className="studio-asset-card studio-asset-audio">
              <div className="studio-asset-card-top"><span className="studio-asset-icon" aria-hidden="true">♫</span><span className="studio-asset-kind">02 / AUDIO</span></div>
              <div className="studio-asset-preview studio-asset-audio-preview"><span aria-hidden="true">♫</span><strong>PROFILE AUDIO</strong><small>MP3 · M4A · OGG · WAV · AAC · FLAC</small></div>
              <h3>Audio</h3>
              <p className="muted">Upload audio files, add cover artwork and manage your profile playlist.</p>
              <StudioAudioLibrary
                profileId={saved.profile_id}
                revision={saved.revision}
                gallery={previewGallery.map(({id,alt})=>({id,alt}))}
                onAssetsChanged={async () => (await refreshSaved()).revision}
                onAddTrack={(track, revisionOverride) => {
                  let limitReached = false;
                  const link = {
                    label:track.title+" — "+track.artist,
                    url:track.url,
                    mode:"text" as const,
                    hidden:false,
                    ...(track.coverImageId?{audioCoverImage:track.coverImageId}:{})
                  };
                  edit((current) => {
                    if (current.content.links.length >= linkLimit) {
                      limitReached = true;
                      return current;
                    }
                    return {
                      ...current,
                      ...(typeof revisionOverride === "number" ? { revision: revisionOverride } : {}),
                      content: { ...current.content, links: [...current.content.links, link] },
                    };
                  });
                  setAnnouncement(limitReached
                    ? "Your current plan has reached its profile link limit."
                    : "Track added to your profile draft. Save and publish to make it public.");
                }}
              />
            </article>
            <article className="studio-asset-card studio-asset-avatar">
              <div className="studio-asset-card-top"><span className="studio-asset-icon" aria-hidden="true">◉</span><span className="studio-asset-kind">03 / PROFILE AVATAR</span></div>
              <div className="studio-asset-preview studio-asset-avatar-preview">{avatar}</div>
              <h3>Profile Avatar</h3>
              <p className="muted">Upload or replace the image shown beside your profile name.</p>
            </article>
            <article className="studio-asset-card studio-asset-cursor">
              <div className="studio-asset-card-top"><span className="studio-asset-icon" aria-hidden="true">⌖</span><span className="studio-asset-kind">04 / CUSTOM CURSOR</span></div>
              <div className="studio-asset-preview studio-asset-cursor-preview">
                {content.appearance.customCursorImage && previewGallery.some((image)=>image.id===content.appearance.customCursorImage)
                  ? <img src={"/studio/gallery/image/"+content.appearance.customCursorImage} alt="" loading="lazy"/>
                  : <div className="studio-asset-placeholder"><span aria-hidden="true">↖</span><strong>Default cursor</strong></div>}
              </div>
              <h3>Custom Cursor</h3>
              <p className="muted">Choose a small image to use as the pointer on your profile.</p>
              <label>Cursor image
                <select value={content.appearance.customCursorImage??""} onChange={(event)=>set("appearance",{...content.appearance,customCursorImage:event.target.value||undefined})}>
                  <option value="">Use standard cursor</option>
                  {previewGallery.map((image)=><option key={image.id} value={image.id}>{image.alt||"Uploaded image"}</option>)}
                </select>
              </label>
              <p className="muted">Upload an image with the Background button above, then select it here.</p>
            </article>
          </div>
        </section>

        <fieldset className="stack studio-reference-customization">
          <legend className="section-title">General Customization</legend>
          <div className="studio-reference-customization-grid">
            <label>Description
              <textarea name="bio" maxLength={280} rows={3} value={content.bio}
                onChange={(event)=>set("bio",event.target.value)}/>
            </label>
            <div className="studio-reference-widget">
              <span>Profile Widget</span>
              <Link className="studio-reference-widget-action" href="/studio/discord">
                <span aria-hidden="true">◉</span> Discord Presence <strong>Settings ↗</strong>
              </Link>
            </div>
            <label>Profile Opacity: {content.appearance.opacity??100}%
              <input type="range" min={20} max={100} step={1} value={content.appearance.opacity??100}
                onChange={(event)=>set("appearance",{...content.appearance,opacity:Number(event.target.value)})}/>
            </label>
            <label>Profile Blur: {content.appearance.blur??0}px
              <input type="range" min={0} max={80} step={1} value={content.appearance.blur??0}
                onChange={(event)=>set("appearance",{...content.appearance,blur:Number(event.target.value)})}/>
            </label>
            <label>Location
              <input type="text" maxLength={80} autoComplete="off" placeholder="Your location"
                value={content.appearance.location??""}
                onChange={(event)=>set("appearance",{...content.appearance,location:event.target.value||undefined})}/>
            </label>
            <div className="studio-reference-glow-settings">
              <strong>Glow Settings</strong>
              <div className="studio-reference-glow-options">
                <label className="check"><input type="checkbox" checked={content.appearance.usernameGlow??false}
                  onChange={(event)=>set("appearance",{...content.appearance,usernameGlow:event.target.checked})}/> Username</label>
                <label className="check"><input type="checkbox" checked={content.appearance.socialGlow??false}
                  onChange={(event)=>set("appearance",{...content.appearance,socialGlow:event.target.checked})}/> Socials</label>
                <label className="check"><input type="checkbox" checked={content.appearance.badgeGlow??false}
                  onChange={(event)=>set("appearance",{...content.appearance,badgeGlow:event.target.checked})}/> Badges</label>
              </div>
            </div>
          </div>
          <label className="check studio-reference-location-toggle">
            <input type="checkbox" checked={content.appearance.showLocation??false}
              disabled={!content.appearance.location?.trim()}
              onChange={(event)=>set("appearance",{...content.appearance,showLocation:event.target.checked})}/>
            Show location on my profile
          </label>
        </fieldset>

        <EffectsEditor
          value={content.appearance.effects}
          tier={effectTier}
          onChange={(effects)=>set("appearance",{...content.appearance,effects})}
        />

        <fieldset className="stack studio-reference-customization">
          <legend className="section-title">Color Customization</legend>
          <div className="studio-reference-color-grid">
            <label>Accent Color<input type="color" value={customColours.accent??"#9b8cff"}
              onChange={(event)=>set("appearance",{...content.appearance,colors:{...customColours,accent:event.target.value}})}/></label>
            <label>Text Color<input type="color" value={customColours.text??"#f5f6fa"}
              onChange={(event)=>set("appearance",{...content.appearance,colors:{...customColours,text:event.target.value}})}/></label>
            <label>Background Color<input type="color" value={customColours.background??"#171923"}
              onChange={(event)=>set("appearance",{...content.appearance,colors:{...customColours,background:event.target.value}})}/></label>
            <label>Icon Color<input type="color" value={customColours.icon??"#e4e7f0"}
              onChange={(event)=>set("appearance",{...content.appearance,colors:{...customColours,icon:event.target.value}})}/></label>
            <label>Background Effect Color<input type="color" value={customColours.effect??"#7c72d8"}
              onChange={(event)=>set("appearance",{...content.appearance,colors:{...customColours,effect:event.target.value}})}/></label>
            <label>Primary Color<input type="color" value={customColours.gradientStart??"#493c96"}
              onChange={(event)=>set("appearance",{...content.appearance,colors:{...customColours,gradientStart:event.target.value}})}/></label>
            <label>Secondary Color<input type="color" value={customColours.gradientEnd??"#137f83"}
              onChange={(event)=>set("appearance",{...content.appearance,colors:{...customColours,gradientEnd:event.target.value}})}/></label>
          </div>
          <label className="check"><input type="checkbox" checked={content.appearance.gradientEnabled??false}
            onChange={(event)=>set("appearance",{...content.appearance,gradientEnabled:event.target.checked})}/> Enable profile gradient</label>
        </fieldset>

        <fieldset className="stack studio-reference-customization">
          <legend className="section-title">Other Customization</legend>
          <div className="studio-reference-other-options">
            <label className="check"><input type="checkbox" checked={content.appearance.monochromeIcons??false}
              onChange={(event)=>set("appearance",{...content.appearance,monochromeIcons:event.target.checked})}/> Monochrome Icons</label>
            <label className="check"><input type="checkbox" checked={content.appearance.animatedTitle??false}
              onChange={(event)=>set("appearance",{...content.appearance,animatedTitle:event.target.checked})}/> Animated Title</label>
            <label className="check"><input type="checkbox" checked={content.appearance.swapBoxColors??false}
              onChange={(event)=>set("appearance",{...content.appearance,swapBoxColors:event.target.checked})}/> Swap Box Colors</label>
          </div>
        </fieldset>
        {template&&<fieldset className="stack">
          <legend className="section-title">Template</legend>
          <p className="muted">{template.categoryLabel} · {template.description}</p>
          <button type="button" className="button small primary" onClick={()=>applyTemplate(false)}>Apply template design</button>
        </fieldset>}
      </section>
      <section role="tabpanel" aria-labelledby="editor-tab-Sections" id="editor-panel-Sections" data-editor-panel="Sections" hidden={tab !== "Sections"} className="editor-panel stack">
        <TextSectionsEditor sections={content.sections} onChange={(sections) => set("sections", sections)} />
      </section>
      <section role="tabpanel" aria-labelledby="editor-tab-Blocks" id="editor-panel-Blocks" data-editor-panel="Blocks" hidden={tab !== "Blocks"} className="editor-panel stack">
        <ProfileBlocksEditor blocks={content.blocks} onChange={(blocks) => set("blocks", blocks)} />
      </section>
      <section role="tabpanel" aria-labelledby="editor-tab-Widgets" id="editor-panel-Widgets" data-editor-panel="Widgets" hidden={tab !== "Widgets"} className="editor-panel stack">
        <ProfileWidgetsEditor value={content.widgets} onChange={(widgets) => set("widgets", widgets)} />
        <Link className="button small" href={"/studio/widgets/guestbook?profile=" + encodeURIComponent(saved.profile_id)}>Moderate Guestbook messages</Link>
      </section>
      <section role="tabpanel" aria-labelledby="editor-tab-Links" id="editor-panel-Links" data-editor-panel="Links" hidden={tab !== "Links"} className="editor-panel stack">
        <section className="studio-links-image-host-card">
          <div><p className="eyebrow">IMAGE HOST / LIFETIME ADD-ON</p><strong>Host and share your own profile assets</strong>
            <p className="muted">Custom domains, secure uploads, advanced galleries, text pastes and upload analytics.</p></div>
          <ImageHostPurchase offer={imageHostOffer} active={imageHostActive}/>
        </section>
        <section className="studio-links-catalogue stack" aria-labelledby="social-catalogue-title">
          <div className="studio-links-catalogue-heading">
            <div><p className="eyebrow">ADD A LINK</p><h2 id="social-catalogue-title">Social profiles</h2></div>
            <span>{content.links.length} / {linkLimit} links</span>
          </div>
          <label className="studio-provider-search">Search providers
            <input type="search" value={providerQuery} placeholder="Search social, gaming, music…"
              onChange={(event) => setProviderQuery(event.target.value)}/>
          </label>
          <div className="studio-provider-categories" role="group" aria-label="Provider categories">
            {socialProviderCategories.map((category) => <button key={category} type="button"
              className="button small" aria-pressed={providerCategory === category}
              onClick={() => setProviderCategory(category)}>{category}</button>)}
          </div>
          <div className="studio-provider-grid">
            {filterSocialProviders(providerQuery, providerCategory).map((provider) => <button type="button"
              key={provider.id} className="studio-provider-card" disabled={content.links.length >= linkLimit}
              onClick={() => addSocialProvider(provider)}>
              <span className="studio-provider-mark" aria-hidden="true"><SocialProviderIcon providerId={provider.id} /></span>
              <span>{provider.label}</span><span className="studio-provider-plus" aria-hidden="true">+</span>
            </button>)}
          </div>
          <button type="button" className="studio-provider-card studio-provider-custom-url"
            disabled={content.links.length >= linkLimit} onClick={() => {
              setCustomUrl(""); setCustomSocialMode("icon"); setCustomIconFile(null);
              setCustomUrlError(""); setCustomUrlOpen(true);
            }}>
            <span className="studio-provider-mark" aria-hidden="true">◎</span>
            <span>Add Custom URL</span><span className="studio-provider-plus" aria-hidden="true">+</span>
          </button>
        </section>
      <fieldset className="stack" ref={linkList}>
        <legend className="section-title">Links <small>{content.links.length}/{linkLimit}</small></legend>
        {content.links.length > linkLimit && <p>Remove links until you reach your current allowance before saving link edits or publishing.</p>}
        {content.links.map((item, index) => <div className="link-editor link-row" key={index} data-reorder-index={index}
          data-drop-target={linkDropIndex === index || undefined}>
          <div className="studio-link-item-heading">
            <span className="studio-provider-mark" aria-hidden="true">
              <SocialProviderIcon providerId={socialProviderForUrl(item.url)?.id ?? "website"} />
            </span>
            <strong>Link {index + 1}</strong>
            <label className="check"><input type="checkbox" checked={!item.hidden} onChange={(event) =>
              set("links", content.links.map((entry, i) => i === index ? { ...entry, hidden: !event.target.checked } : entry))}/> Visible on profile</label>
          </div>
          {content.links.length > 1 && <span className="reorder-handle" aria-hidden="true" {...linkHandle}>Drag to move</span>}
          <label>Link {index + 1} label<input required maxLength={80} value={item.label}
            ref={(input) => { linkLabels.current[index] = input; }}
            onChange={(event) => set("links", content.links.map((entry, i) => i === index ? { ...entry, label: event.target.value } : entry))} /></label>
          <label>Link {index + 1} URL<input required type="text" inputMode="url" autoComplete="url" maxLength={2048} placeholder="https:// or uploaded audio path"
            value={item.url} onChange={(event) => set("links", content.links.map((entry, i) => i === index ? { ...entry, url: event.target.value } : entry))} /></label>
          <label>Display mode
            <select value={item.mode ?? "icon"} onChange={(event) => {
              const mode = event.target.value === "text" ? "text" : "icon";
              set("links", content.links.map((entry, i) => i === index ? { ...entry, mode } : entry));
            }}>
              <option value="icon">Icon link</option>
              <option value="text">Text link</option>
            </select>
          </label>
          {(item.mode ?? "icon") === "icon" ? (
            <label>Custom icon (optional)
              <select value={item.iconImage ?? ""} onChange={(event) =>
                set("links", content.links.map((entry, i) => i === index ? { ...entry, iconImage: event.target.value || undefined } : entry))}>
                <option value="">Use detected platform icon</option>
                {previewGallery.map((image) => <option key={image.id} value={image.id}>{image.alt || "Uploaded image"}</option>)}
              </select>
            </label>
          ) : null}
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
            set("links", [...content.links, { label: "", url: "", hidden: false }]);
            focusLink(content.links.length);
          }}>Add link</button>
        {content.links.length < linkLimit && <details>
          <summary>Add a hosted audio track</summary>
          <div className="stack">
            <p className="muted">Upload audio in Customize → Profile audio library. Add the uploaded track to your profile from there; it will appear after you save and publish.</p>
          </div>
        </details>}
        {customUrlOpen && <div className="studio-custom-url-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !customIconBusy) setCustomUrlOpen(false);
        }}>
          <section className="studio-custom-url-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-custom-url-title">
            <button type="button" className="studio-custom-url-close" aria-label="Close custom URL dialog"
              disabled={customIconBusy} onClick={() => setCustomUrlOpen(false)}>×</button>
            <p className="eyebrow">LINKS / SOCIAL PROFILES</p>
            <h2 id="studio-custom-url-title">Add Custom URL Social</h2>
            <p className="muted">Add a website or social destination that is not in the provider list.</p>
            <label>Social Mode
              <div className="studio-custom-url-mode" role="group" aria-label="Social Mode">
                <button type="button" aria-pressed={customSocialMode === "icon"} className={customSocialMode === "icon" ? "is-selected" : ""}
                  onClick={() => setCustomSocialMode("icon")}>Link</button>
                <button type="button" aria-pressed={customSocialMode === "text"} className={customSocialMode === "text" ? "is-selected" : ""}
                  onClick={() => setCustomSocialMode("text")}>Text</button>
              </div>
            </label>
            {customSocialMode === "icon" && <div className="studio-custom-url-icon">
              <strong>Upload icon (optional)</strong>
              <p className="muted">JPEG, PNG or WebP · up to 4 MB. Images are resized and metadata is removed.</p>
              <button type="button" className="button small" disabled={customIconBusy}
                onClick={() => customIconInput.current?.click()}>
                {customIconFile ? "Change icon" : "Choose icon"}
              </button>
              {customIconFile && <small>Selected: {customIconFile.name}</small>}
              <input ref={customIconInput} type="file" accept={galleryTypes.join(",")} disabled={customIconBusy} hidden
                onChange={(event) => { setCustomIconFile(event.target.files?.[0] ?? null); setCustomUrlError(""); }}/>
            </div>}
            <label>URL<input type="url" autoComplete="url" maxLength={2048} placeholder="https://example.com"
              value={customUrl} onChange={(event) => setCustomUrl(event.target.value)}/></label>
            {customUrlError && <p className="message error" role="alert">{customUrlError}</p>}
            <div className="studio-custom-url-actions">
              <button type="button" className="button" disabled={customIconBusy} onClick={() => setCustomUrlOpen(false)}>Cancel</button>
              <button type="button" className="button primary" disabled={customIconBusy || content.links.length >= linkLimit}
                onClick={() => void addCustomUrl()}>{customIconBusy ? "Uploading…" : "Add"}</button>
            </div>
          </section>
        </div>}


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
    <aside className={"preview stack" + (dropActive ? " is-drop-active" : "")}
      data-drop-active={dropActive || undefined}>
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
      <div className={"preview-card preview-" + previewSize + (dropActive ? " is-drop-active" : "")}>
        <ProfileCard preview galleryBase="/studio/gallery/image" profile={template ? {
          ...saved, ...content, gallery: previewGallery, theme: template.theme, appearance: { ...content.appearance, ...template.appearance },
          sections: content.sections.length ? content.sections : template.sections,
        } : { ...saved, ...content, gallery: previewGallery }}
          avatarSrc={saved.avatar && !removeAvatar ? `/studio/avatar/${saved.avatar}` : undefined}
          onMoveLayoutItem={(from, to) => set("pageLayout", moveProfilePageElement(pageLayout, from, to, { ...content, gallery: saved.gallery }))}
          onSelectLayoutItem={(item: ProfilePageLayoutItem) => {
            if (item.type === "section") setTab("Sections");
            else if (item.type === "block") setTab("Blocks");
            else if (item.type === "links") setTab("Links");
            else if (item.type === "widgets") setTab("Widgets");
            else setTab("Design");
          }} />
        {dropActive && <div className="preview-drop-overlay" aria-hidden="true"><span>Drop to add to your page</span></div>}
      </div>
      <p className="preview-drop-help">Tip: drag any block from <strong>Add to page</strong> and drop it onto this preview. You can also use the <strong>+</strong> buttons.</p>
    </aside>
  </div></div>;
}
