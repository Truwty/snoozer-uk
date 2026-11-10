"use client";

import { useState } from "react";
import { themes, type DraftProfile, type ProfileContent } from "@/lib/profile";
import { ActionMessage } from "./action-message";
import { ProfileCard } from "./profile-card";
import { useDraftEditor } from "./use-draft-editor";

export function Editor({ draft }: { draft: DraftProfile }) {
  const { saved, edits, edit, pending, conflict, message, commit, discardAndReload } = useDraftEditor(draft);
  const [compact, setCompact] = useState(false);
  const content = edits?.content ?? saved;
  const removeAvatar = edits?.removeAvatar ?? false;

  function set<K extends keyof ProfileContent>(field: K, value: ProfileContent[K]) {
    edit((current) => ({ ...current, content: { ...current.content, [field]: value } }));
  }

  function move(from: number, to: number) {
    const reordered = [...content.links];
    [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
    set("links", reordered);
  }

  return <div className="editor-grid">
    <form className="panel editor-form stack" onSubmit={(event) => {
      event.preventDefault();
      const button = (event.nativeEvent as SubmitEvent).submitter;
      void commit(button instanceof HTMLButtonElement && button.value === "publish" ? "publish" : "draft");
    }}>
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
        <label className="check"><input type="checkbox" name="indexable" checked={content.indexable}
          onChange={(event) => set("indexable", event.target.checked)} /> Allow search engines to index my published page</label>
        {saved.avatar && <label className="check"><input type="checkbox" name="remove_avatar" checked={removeAvatar} disabled={pending}
          onChange={(event) => {
            const checked = event.target.checked;
            edit((current) => ({ ...current, removeAvatar: checked }));
          }} /> Remove avatar on next manual save</label>}
      </fieldset>
      <fieldset className="stack">
        <legend className="section-title">Links <small>{content.links.length}/20</small></legend>
        {content.links.map((item, index) => <div className="link-editor stack" key={index}>
          <label>Link {index + 1} label<input required maxLength={80} value={item.label}
            onChange={(event) => set("links", content.links.map((entry, i) => i === index ? { ...entry, label: event.target.value } : entry))} /></label>
          <label>Link {index + 1} URL<input required type="url" maxLength={2048} placeholder="https://"
            value={item.url} onChange={(event) => set("links", content.links.map((entry, i) => i === index ? { ...entry, url: event.target.value } : entry))} /></label>
          <div className="actions">
            <button type="button" className="button small" disabled={index === 0} aria-label={`Move up (link ${index + 1})`} onClick={() => move(index, index - 1)}>Move up</button>
            <button type="button" className="button small" disabled={index === content.links.length - 1} aria-label={`Move down (link ${index + 1})`} onClick={() => move(index, index + 1)}>Move down</button>
            <button type="button" className="button small" aria-label={`Remove link ${index + 1}`} onClick={() => set("links", content.links.filter((_, i) => i !== index))}>Remove</button>
          </div>
        </div>)}
        <button className="button" type="button" disabled={content.links.length >= 20}
          onClick={() => set("links", [...content.links, { label: "", url: "" }])}>Add link</button>
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
              links: content.links, removeAvatar,
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
        <p className="eyebrow">LIVE PREVIEW</p>
        <button type="button" className="button small" aria-pressed={compact} onClick={() => setCompact(!compact)}>Phone width</button>
      </div>
      <div className={compact ? "preview-phone" : undefined}>
        <ProfileCard preview profile={{ ...saved, ...content }}
          avatarSrc={saved.avatar && !removeAvatar ? `/studio/avatar/${saved.avatar}` : undefined} />
      </div>
    </aside>
  </div>;
}
