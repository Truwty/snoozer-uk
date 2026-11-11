"use client";

import { useState, type FormEvent } from "react";
import { addLibraryImage } from "@/app/studio/gallery/actions";
import { galleryLimit } from "@/lib/gallery";
import { changeMediaFolders } from "@/app/studio/gallery/folders/actions";
import { initialState, type ActionState } from "@/lib/actions";
import { mediaFolderLimit, type FolderEdit, type MediaLibrary } from "@/lib/media-folders";
import { ActionMessage } from "./action-message";

function field(form: HTMLFormElement, name: string) {
  const value = new FormData(form).get(name);
  return typeof value === "string" ? value : "";
}

export function MediaFolderEditor({ library, draftRevision, draftSize }: {
  library: MediaLibrary;
  draftRevision: number;
  draftSize: number;
}) {
  const [selection, setSelection] = useState("");
  const [state, setState] = useState<ActionState>(initialState);
  const [busy, setBusy] = useState(false);
  const { folders, items } = library;
  const selectedFolder = folders.find(({ id }) => id === selection);
  const filter = selectedFolder?.id ?? (selection === "unfiled" ? selection : "");
  const visible = items.filter((item) => !filter || item.folder === (filter === "unfiled" ? null : filter));

  async function save(edit: FolderEdit, onSuccess?: () => void) {
    setBusy(true);
    setState(initialState);
    try {
      const next = await changeMediaFolders(library.scope, library.revision, edit);
      if (next.status === "success") onSuccess?.();
      setState(next);
    } catch {
      setState({ status: "error", message: "Couldn’t save that folder change. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function addImage(id: string) {
    setBusy(true);
    setState(initialState);
    try {
      const result = await addLibraryImage(draftRevision, id);
      setState(result.error ? { status: "error", message: result.error } : { status: "success", message: result.message ?? "Image added to your draft." });
    } catch {
      setState({ status: "error", message: "Couldn’t add the image. Try again." });
    } finally {
      setBusy(false);
    }
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void save({ operation: "create", name: field(form, "name") }, () => form.reset());
  }

  return <div className="stack">
    <form className="actions media-folder-form" onSubmit={create}>
      <label>New folder name<input name="name" required maxLength={60} disabled={busy || folders.length >= mediaFolderLimit} /></label>
      <button className="button small" disabled={busy || folders.length >= mediaFolderLimit}>Create folder</button>
    </form>
    {folders.length >= mediaFolderLimit && <p>You have reached the 12 folder limit.</p>}
    <ActionMessage state={state} />
    {draftSize >= galleryLimit && items.some((item) => !item.in_draft) && <p>Your draft gallery is full. Remove an image to add another.</p>}
    <label>Show images in
      <select value={filter} onChange={(event) => setSelection(event.target.value)}>
        <option value="">All images</option>
        <option value="unfiled">Unfiled</option>
        {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
      </select>
    </label>
    {selectedFolder && <details className="panel">
      <summary>Manage {selectedFolder.name}</summary>
      <div className="stack media-folder-settings">
        <form key={selectedFolder.id + selectedFolder.name} className="actions media-folder-form" onSubmit={(event) => {
          event.preventDefault();
          void save({ operation: "rename", id: selectedFolder.id, name: field(event.currentTarget, "name") });
        }}>
          <label>Folder name<input name="name" defaultValue={selectedFolder.name} required maxLength={60} disabled={busy} /></label>
          <button className="button small" disabled={busy}>Rename folder</button>
        </form>
        <p>Deleting this folder moves its images to Unfiled.</p>
        <div><button className="button small" type="button" disabled={busy}
          onClick={() => save({ operation: "delete", id: selectedFolder.id }, () => setSelection("unfiled"))}>Delete folder</button></div>
      </div>
    </details>}
    <h2>{selectedFolder?.name ?? (filter === "unfiled" ? "Unfiled" : "All images")}</h2>
    {!visible.length && <p>{filter ? "There are no images here." : "Upload an image in the gallery to start your library."}</p>}
    {!!visible.length && <ul className="gallery-editor-grid" aria-label="Media library images">
      {visible.map((item) => <li className="panel stack" key={item.id}>
        {/* The owner image route serves an already resized WebP. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="gallery-image" src={"/studio/gallery/image/" + item.id} alt={item.alt}
          width={item.width} height={item.height} loading="lazy" />
        <p>{item.alt}</p>
        <small>{item.in_draft ? "In your draft" : "In publish history"}</small>
        {!item.in_draft && <div><button className="button small" type="button" disabled={busy || draftSize >= galleryLimit}
          onClick={() => void addImage(item.id)}>Add to draft gallery</button></div>}
        <form className="stack" key={item.folder ?? "unfiled"} onSubmit={(event) => {
          event.preventDefault();
          void save({ operation: "move", id: item.id, folder: field(event.currentTarget, "folder") || null });
        }}>
          <label>Folder for {item.alt}
            <select name="folder" defaultValue={item.folder ?? ""} disabled={busy}>
              <option value="">Unfiled</option>
              {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
            </select>
          </label>
          <div><button className="button small" disabled={busy}>Save location</button></div>
        </form>
      </li>)}
    </ul>}
  </div>;
}
