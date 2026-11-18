"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { kofiProfileUrl } from "@/lib/kofi-link";
import { galleryMemoryWarning } from "@/lib/gallery-budget";
import { profileCorners, profileDensities, profileLayouts, themes, type DraftProfile, type ProfileContent } from "@/lib/profile";
import { linkAccents, linkAccentColours, linkAccentLabels } from "@/lib/link-accent";
import { studioTemplates } from "@/lib/studio-templates";
import { VisualSelect } from "./visual-select";
import { CopyLink } from "./copy-link";
import { Unpublish } from "./unpublish";
import { AppearanceTransfer } from "./appearance-transfer";
import { ActionMessage } from "./action-message";
import { ProfileCard } from "./profile-card";
import { TextSectionsEditor } from "./text-sections-editor";
import { useDraftEditor } from "./use-draft-editor";
import { usePointerReorder } from "./use-pointer-reorder";

export function Editor({ draft, linkLimit, galleryHref, initialTemplateId = "", avatar, settings }: { avatar: ReactNode; settings: ReactNode; draft: DraftProfile; linkLimit: number; galleryHref: string; initialTemplateId?: string }) {
  const { saved, edits, edit, pending, conflict, message, commit, discardAndReload, travel, canUndo, canRedo } = useDraftEditor(draft);
  const tabs = ["Profile", "Design", "Links", "Sections", "Settings"] as const;
  const [tab, setTab] = useState<typeof tabs[number]>(initialTemplateId ? "Design" : "Profile");
  const [previewSize, setPreviewSize] = useState("wide");
  const [templateId, setTemplateId] = useState(initialTemplateId);
  const template = studioTemplates.find(({ id }) => id === templateId);
  const [kofiUrl, setKofiUrl] = useState("");
  const [kofiError, setKofiError] = useState(false);
  const [announcement, setAnnouncement] = useState("");
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
        ...current.content, theme: template.theme, appearance: template.appearance ?? current.content.appearance,
        sections: includeSections && current.content.sections.length === 0 ? template.sections : current.content.sections,
      },
    }));
    setTemplateId("");
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

  function focusLink(index: number) {
    window.requestAnimationFrame(() => (linkLabels.current[index] ?? addLink.current)?.focus());
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
      <div className="editor-tabs" role="tablist" aria-label="Profile editor">
        {tabs.map((name, index) => <button key={name} id={`editor-tab-${name}`} type="button" role="tab" aria-selected={tab === name}
          aria-controls={`editor-panel-${name}`} tabIndex={tab === name ? 0 : -1} onClick={() => setTab(name)}
          onKeyDown={(event) => {
            const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
            const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : direction ? (index + direction + tabs.length) % tabs.length : null;
            if (next !== null) { event.preventDefault(); setTab(tabs[next]); document.getElementById(`editor-tab-${tabs[next]}`)?.focus(); }
          }}>{name}</button>)}
      </div>
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
        </select></VisualSelect>
        <label>Background entrance<select value={content.appearance.entrance} onChange={(event) => {
          const entrance = event.target.value;
          if (entrance === "none" || entrance === "fade") set("appearance", { ...content.appearance, entrance });
        }}>
          <option value="none">None</option>
          <option value="fade">Fade in</option>
        </select></label>
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
        edit((current) => ({ ...current, content: { ...current.content, ...settings } }));
        setTemplateId("");
      }} />
      </section>
      <section role="tabpanel" aria-labelledby="editor-tab-Sections" id="editor-panel-Sections" data-editor-panel="Sections" hidden={tab !== "Sections"} className="editor-panel stack">
        <TextSectionsEditor sections={content.sections} onChange={(sections) => set("sections", sections)} />
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
        <label className="check"><input type="checkbox" form="profile-editor" name="indexable" checked={content.indexable}
          onChange={(event) => set("indexable", event.target.checked)} /> Allow search engines to index my published page</label>
        {saved.avatar && <label className="check"><input type="checkbox" form="profile-editor" name="remove_avatar" checked={removeAvatar} disabled={pending}
          onChange={(event) => {
            const checked = event.target.checked;
            edit((current) => ({ ...current, removeAvatar: checked }));
          }} /> Remove avatar on next manual save</label>}

      {saved.published_revision !== null && <Unpublish profileId={saved.profile_id} revision={saved.revision} />}
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
      <div className={"preview-card preview-" + previewSize}>
        <ProfileCard preview galleryBase="/studio/gallery/image" profile={template ? {
          ...saved, ...content, theme: template.theme, appearance: template.appearance ?? content.appearance,
          sections: content.sections.length ? content.sections : template.sections,
        } : { ...saved, ...content }}
          avatarSrc={saved.avatar && !removeAvatar ? `/studio/avatar/${saved.avatar}` : undefined} />
      </div>
    </aside>
  </div></div>;
}
