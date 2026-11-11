"use client";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent } from "react";
import { discardGalleryUpload, editGallery, finishGalleryUpload, startGalleryUpload } from "@/app/studio/gallery/actions";
import { galleryIncoming, galleryLimit, galleryMaxBytes, galleryTypes, type GalleryItem } from "@/lib/gallery";
import { supabaseConfig } from "@/lib/env";
import { initialState, type ActionState } from "@/lib/actions";
import { ActionMessage } from "./action-message";

const invalidFileMessage = "Choose a JPEG, PNG or WebP image up to 4 MB.";

function isGalleryFile(file: File) {
  return file.size > 0 && file.size <= galleryMaxBytes && galleryTypes.includes(file.type);
}

type Result = { message?: string; error?: string };
export function GalleryEditor({ revision, items, pending }: {
  revision: number;
  items: GalleryItem[];
  pending: Pick<GalleryItem, "id" | "alt"> | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>(initialState);
  const [busy, setBusy] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const altInput = useRef<HTMLInputElement>(null);

  async function run(task: () => Promise<Result>) {
    setBusy(true);
    setState(initialState);
    try {
      const result = await task();
      setState(result.error ? { status: "error", message: result.error }
        : { status: "success", message: result.message ?? "Saved." });
      if (!result.error) {
        setDroppedFile(null);
        if (fileInput.current) fileInput.current.value = "";
      }
      if (!result.error && altInput.current) altInput.current.value = "";
    } catch {
      setState({ status: "error", message: "Couldn’t complete that gallery action. Try again." });
    } finally {
      router.refresh();
      setBusy(false);
    }
  }

  function dropImage(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (busy) return;
    const files = event.dataTransfer.files;
    if (files.length !== 1 || !isGalleryFile(files[0])) {
      setState({ status: "error", message: files.length > 1 ? "Drop one image at a time." : invalidFileMessage });
      return;
    }
    if (fileInput.current) fileInput.current.value = "";
    setDroppedFile(files[0]);
    setState(initialState);
  }

  async function upload(): Promise<Result> {
    const file = droppedFile ?? fileInput.current?.files?.[0];
    if (!file) return { error: "Choose an image first." };
    if (!isGalleryFile(file)) return { error: invalidFileMessage };
    const result = await startGalleryUpload(revision, pending?.alt ?? altInput.current?.value ?? "");
    if (result.error || !result.id || !result.path || !result.token) return { error: result.error ?? "Couldn’t open the upload." };
    const { url, key } = supabaseConfig();
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { error } = await client.storage.from(galleryIncoming)
      .uploadToSignedUrl(result.path, result.token, file, { contentType: file.type });
    if (error) return { error: "Couldn’t upload the image. Try again or finish the pending upload." };
    return finishGalleryUpload(revision, result.id);
  }

  return <div className="stack">
    {items.length ? <ol className="gallery-editor-grid" aria-label="Draft gallery images">
      {items.map((item, index) => <li className="panel stack" key={item.id}>
        {/* The route serves a resized raster after checking the owner. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="gallery-image" src={"/studio/gallery/image/" + item.id} alt={item.alt}
          width={item.width} height={item.height} loading="lazy" />
        <p>{item.alt}</p>
        <div className="actions" role="group" aria-label={"Actions for " + item.alt}>
          <button type="button" className="button small" disabled={busy || index === 0}
            onClick={() => run(() => editGallery(revision, item.id, "earlier"))}>Move earlier</button>
          <button type="button" className="button small" disabled={busy || index === items.length - 1}
            onClick={() => run(() => editGallery(revision, item.id, "later"))}>Move later</button>
          <button type="button" className="button small" disabled={busy}
            onClick={() => run(() => editGallery(revision, item.id, "remove"))}>Remove from draft</button>
        </div>
      </li>)}
    </ol> : <p>Your draft gallery is empty.</p>}
    {(items.length < galleryLimit || pending) && <form className="stack" onSubmit={(event) => { event.preventDefault(); void run(upload); }}>
      {pending
        ? <p>Pending image: <strong>{pending.alt}</strong>. Finish it if the file uploaded, or choose the file again.</p>
        : <label>Image description<input ref={altInput} required maxLength={180} disabled={busy}
          aria-describedby="gallery-alt-help" /></label>}
      {!pending && <small id="gallery-alt-help">Describe what matters in the image for people who can’t see it.</small>}
      <div className="stack gallery-drop-zone" onDrop={dropImage} onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = busy ? "none" : "copy";
      }}>
        <p>Drop one image here or use the file picker.</p>
        <label>Choose a gallery image<input ref={fileInput} type="file" accept={galleryTypes.join(",")}
          disabled={busy} aria-describedby="gallery-file-help" onChange={() => {
            setDroppedFile(null);
            setState(initialState);
          }} /></label>
        <small id="gallery-file-help">JPEG, PNG or WebP, up to 4 MB. Images are resized and metadata is removed.</small>
        <p aria-live="polite">{droppedFile ? "Selected image: " + droppedFile.name : ""}</p>
      </div>
      <div className="actions">
        <button className="button small" disabled={busy}>{busy ? "Working…" : "Upload image"}</button>
        {pending && <>
          <button type="button" className="button small" disabled={busy}
            onClick={() => run(() => finishGalleryUpload(revision, pending.id))}>Finish pending upload</button>
          <button type="button" className="button small" disabled={busy}
            onClick={() => run(() => discardGalleryUpload(revision, pending.id))}>Discard pending upload</button>
        </>}
      </div>
    </form>}
    <ActionMessage state={state} />
  </div>;
}
