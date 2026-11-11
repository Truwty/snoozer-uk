"use client";

import { useRef, useState } from "react";
import { profileCorners, profileDensities, profileLayouts, themes, type DraftProfile, type ProfileContent } from "@/lib/profile";
import { linkAccents, linkAccentColours, linkAccentLabels } from "@/lib/link-accent";
import { studioTemplates } from "@/lib/studio-templates";
import { ActionMessage } from "./action-message";
import { ProfileCard } from "./profile-card";
import { TextSectionsEditor } from "./text-sections-editor";
import { useDraftEditor } from "./use-draft-editor";
import { usePointerReorder } from "./use-pointer-reorder";

export function Editor({ draft, initialTemplateId = "" }: { draft: DraftProfile; initialTemplateId?: string }) {
  const { saved, edits, edit, pending, conflict, message, commit, discardAndReload, travel, canUndo, canRedo } = useDraftEditor(draft);
  const [previewSize, setPreviewSize] = useState("wide");
  const [templateId, setTemplateId] = useState(initialTemplateId);
  const template = studioTemplates.find(({ id }) => id === templateId);
  const [announcement, setAnnouncement] = useState("");
  const linkLabels = useRef<Record<number, HTMLInputElement | null>>({});
  const addLink = useRef<HTMLButtonElement>(null);
  const content = edits?.content ?? saved;
  const removeAvatar = edits?.removeAvatar ?? false;
  const linkColours = linkAccentColours(content.appearance.accent);
  const { list: linkList, dropIndex: linkDropIndex, handle: linkHandle } = usePointerReorder(content.links, move);

  function set<K extends keyof ProfileContent>(field: K, value: ProfileContent[K]) {
    edit((current) => ({ ...current, content: { ...current.content, [field]: value } }));
  }

  function applyTemplate(includeSections: boolean) {
    if (!template) return;
    edit((current) => ({
      ...current,
      content: {
        ...current.content, theme: template.theme,
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

  function focusLink(index: number) {
    window.requestAnimationFrame(() => (linkLabels.current[index] ?? addLink.current)?.focus());
  }

  return <div className="editor-grid">
    <form className="panel editor-form stack" onSubmit={(event) => {
      event.preventDefault();
      const button = (event.nativeEvent as SubmitEvent).submitter;
      void commit(button instanceof HTMLButtonElement && button.value === "publish" ? "publish" : "draft");
    }}>
      <div className="actions" aria-label="Editing history" role="group">
        <button type="button" className="button small" disabled={!canUndo} onClick={() => travel("undo")}>Undo edit</button>
        <button type="button" className="button small" disabled={!canRedo} onClick={() => travel("redo")}>Redo edit</button>
      </div>
      <fieldset className="stack">
        <legend className="section-title">Profile details</legend>
        <label>Display name<input name="display_name" maxLength={60} required value={content.display_name}
          onChange={(event) => set("display_name", event.target.value)} /></label>
        <label>Bio<textarea name="bio" maxLength={280} rows={4} value={content.bio}
          onChange={(event) => set("bio", event.target.value)} /></label>
        <label>Theme<select name="theme" value={content.theme}
          onChange={(event) => set("theme", event.target.value as ProfileContent["theme"])}>
          {themes.map((theme) => <option key={theme} value={theme}>{theme[0].toUpperCase() + theme.slice(1)}</option>)}
        </select></label>
        <label>Profile layout<select value={content.appearance.layout} onChange={(event) => {
          const layout = profileLayouts.find((value) => value === event.target.value);
          if (layout) set("appearance", { ...content.appearance, layout });
        }}>
          <option value="centred">Centred card</option>
          <option value="editorial">Editorial</option>
        </select></label>
        <label>Card spacing<select value={content.appearance.density} onChange={(event) => {
          const density = profileDensities.find((value) => value === event.target.value);
          if (density) set("appearance", { ...content.appearance, density });
        }}>
          {profileDensities.map((value) => <option value={value} key={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
        </select></label>
        <label>Card corners<select value={content.appearance.corners} onChange={(event) => {
          const corners = profileCorners.find((value) => value === event.target.value);
          if (corners) set("appearance", { ...content.appearance, corners });
        }}>
          {profileCorners.map((value) => <option value={value} key={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
        </select></label>
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
        <label className="check"><input type="checkbox" name="indexable" checked={content.indexable}
          onChange={(event) => set("indexable", event.target.checked)} /> Allow search engines to index my published page</label>
        {saved.avatar && <label className="check"><input type="checkbox" name="remove_avatar" checked={removeAvatar} disabled={pending}
          onChange={(event) => {
            const checked = event.target.checked;
            edit((current) => ({ ...current, removeAvatar: checked }));
          }} /> Remove avatar on next manual save</label>}
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
      <TextSectionsEditor sections={content.sections} onChange={(sections) => set("sections", sections)} />
      <fieldset className="stack" ref={linkList}>
        <legend className="section-title">Links <small>{content.links.length}/20</small></legend>
        <p className="sr-only" aria-live="polite">{announcement}</p>
        {content.links.map((item, index) => <div className="link-editor stack" key={index} data-reorder-index={index}
          data-drop-target={linkDropIndex === index || undefined}>
          {content.links.length > 1 && <span className="reorder-handle" aria-hidden="true" {...linkHandle}>Drag to move</span>}
          <label>Link {index + 1} label<input required maxLength={80} value={item.label}
            ref={(input) => { linkLabels.current[index] = input; }}
            onChange={(event) => set("links", content.links.map((entry, i) => i === index ? { ...entry, label: event.target.value } : entry))} /></label>
          <label>Link {index + 1} URL<input required type="url" maxLength={2048} placeholder="https://"
            value={item.url} onChange={(event) => set("links", content.links.map((entry, i) => i === index ? { ...entry, url: event.target.value } : entry))} /></label>
          <div className="actions">
            <button type="button" className="button small" disabled={index === 0} aria-label={`Move up (link ${index + 1})`} onClick={() => move(index, index - 1)}>Move up</button>
            <button type="button" className="button small" disabled={index === content.links.length - 1} aria-label={`Move down (link ${index + 1})`} onClick={() => move(index, index + 1)}>Move down</button>
            <button type="button" className="button small" aria-label={`Remove link ${index + 1}`} onClick={() => {
              set("links", content.links.filter((_, i) => i !== index));
              setAnnouncement(`Removed link ${index + 1}.`);
              focusLink(Math.min(index, content.links.length - 2));
            }}>Remove</button>
          </div>
        </div>)}
        <button className="button" type="button" ref={addLink} disabled={content.links.length >= 20}
          onClick={() => {
            set("links", [...content.links, { label: "", url: "" }]);
            focusLink(content.links.length);
          }}>Add link</button>
      </fieldset>
      <div className="actions">
        <button className="button" disabled={pending || conflict} name="intent" value="draft">Save draft</button>
        <button className="button primary" disabled={pending || conflict} name="intent" value="publish">Publish page</button>
      </div>
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
      <div className={"preview-card preview-" + previewSize}>
        <ProfileCard preview galleryBase="/studio/gallery/image" profile={template ? {
          ...saved, ...content, theme: template.theme,
          sections: content.sections.length ? content.sections : template.sections,
        } : { ...saved, ...content }}
          avatarSrc={saved.avatar && !removeAvatar ? `/studio/avatar/${saved.avatar}` : undefined} />
      </div>
    </aside>
  </div>;
}
