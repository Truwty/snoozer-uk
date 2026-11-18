"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { discardAvatarUpload, finishAvatarUpload, requestAvatarUpload } from "@/app/studio/avatar-actions";
import { supabaseConfig } from "@/lib/env";
import { FileDrop } from "./ui";
import { ActionMessage } from "./action-message";
import { initialState, type ActionState } from "@/lib/actions";

const maxBytes = 2 * 1024 * 1024;

export function AvatarUpload({ profileId, revision }: { profileId: string; revision: number }) {
  const [state, setState] = useState<ActionState>(initialState);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);
  const input = useRef<HTMLInputElement>(null);

  async function upload() {
    const file = input.current?.files?.[0];
    if (file && (file.size > maxBytes || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      setState({ status: "error", message: "Choose a JPEG, PNG or WebP image under 2 MB." });
      return;
    }
    setBusy(true);
    setState(initialState);
    try {
      const intent = await requestAvatarUpload(profileId, revision, Boolean(file));
      if (intent.error) throw new Error(intent.error);
      if (!intent.staged) {
        if (!file) throw new Error("Choose an image to upload.");
        const { url, key } = supabaseConfig();
        const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
        const { error } = await client.storage.from("avatar-incoming")
          .uploadToSignedUrl(intent.path!, intent.token!, file, { contentType: file.type });
        if (error) throw new Error("Couldn’t upload the image. Try again.");
      } else if (file) {
        throw new Error("An image is already pending. Clear the file selection to finish it, or discard it before uploading a new image.");
      }
      const result = await finishAvatarUpload(profileId, revision, intent.uploadKey!);
      if (result.error) throw new Error(result.error);
      if (input.current) input.current.value = "";
      setSelected(null); setPreview("");
      setState({ status: "success", message: result.message ?? "Avatar saved." });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "Couldn’t upload the image." });
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    setBusy(true);
    try {
      const result = await discardAvatarUpload(profileId, revision);
      setState(result.error ? { status: "error", message: result.error }
        : { status: "success", message: result.message ?? "Pending upload cleared." });
      if (input.current) input.current.value = "";
      setSelected(null); setPreview("");
    } catch {
      setState({ status: "error", message: "Couldn’t clear the pending upload." });
    } finally {
      setBusy(false);
    }
  }

  return <div className="stack">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {preview && <img className="avatar" src={preview} alt="Selected avatar preview" />}
    <FileDrop label="Choose an avatar" hint="JPEG, PNG or WebP, up to 2 MB. The image is cropped to a square." ref={input} accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0] ?? null; setSelected(file); setPreview(file && file.size <= maxBytes && ["image/jpeg", "image/png", "image/webp"].includes(file.type) ? URL.createObjectURL(file) : ""); }} />
    <div className="actions">
      <button className="button small" type="button" disabled={busy} onClick={upload}>{busy ? "Working…" : selected ? "Upload avatar" : "Finish pending upload"}</button>
      <details><summary>Upload recovery</summary><button className="button small danger" type="button" disabled={busy} onClick={discard}>Discard pending upload</button></details>
    </div>
    <ActionMessage state={state} />
  </div>;
}
