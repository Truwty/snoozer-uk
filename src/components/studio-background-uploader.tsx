"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "@/lib/env";
import { galleryIncoming, galleryMaxBytes, galleryTypes, type GalleryItem } from "@/lib/gallery";
import { startGalleryUpload, finishGalleryUpload, discardGalleryUpload } from "@/app/studio/gallery/actions";
import {
  discardProfileBackgroundVideoUpload, finishProfileBackgroundVideoUpload,
  loadProfileBackgroundVideos, startProfileBackgroundVideoUpload,
} from "@/app/studio/background-video/actions";
import type { ProfileBackgroundVideoExtension } from "@/lib/profile-background-video";

type BackgroundVideoItem = {
  id: string;
  extension: ProfileBackgroundVideoExtension;
  contentType: "video/mp4" | "video/webm";
  bytes: number;
  createdAt?: string;
};

type Props = {
  profileId: string;
  revision: number;
  gallery: GalleryItem[];
  backgroundImage?: string;
  backgroundVideo?: string;
  onSelectImage: (id?: string) => void;
  onSelectVideo: (id?: string) => void;
  onImageAdded: (image: GalleryItem) => void;
};

const videoAccept = ".mp4,.webm,video/mp4,video/webm";

export function StudioBackgroundUploader({
  profileId, revision, gallery, backgroundImage, backgroundVideo,
  onSelectImage, onSelectVideo, onImageAdded,
}: Props) {
  const [videos, setVideos] = useState<BackgroundVideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"image" | "video" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void loadProfileBackgroundVideos(profileId).then((result) => {
      if (!active) return;
      setVideos(result.items as BackgroundVideoItem[]);
      setError(result.error);
      setLoading(false);
    });
    return () => { active = false; };
  }, [profileId]);

  async function uploadImage(file: File) {
    if (busy) return;
    if (file.size < 1 || file.size > galleryMaxBytes || !galleryTypes.includes(file.type)) {
      setError("Choose a JPEG, PNG or WebP background image up to 4 MB.");
      return;
    }
    setBusy("image"); setError(""); setMessage("");
    let stagedId: string | undefined;
    try {
      const started = await startGalleryUpload(profileId, revision, "Profile background");
      if ("error" in started || !started.id || !started.path || !started.token) {
        setError(started.error ?? "Could not prepare the background image upload.");
        return;
      }
      stagedId = started.id;
      const config = supabaseConfig();
      const browser = createBrowserClient(config.url, config.key);
      const { error: uploadError } = await browser.storage.from(galleryIncoming)
        .uploadToSignedUrl(started.path, started.token, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        await discardGalleryUpload(profileId, revision, started.id);
        stagedId = undefined;
        setError("The background image could not be uploaded. Try again.");
        return;
      }
      const completed = await finishGalleryUpload(profileId, revision, started.id);
      if ("error" in completed) {
        await discardGalleryUpload(profileId, revision, started.id);
        stagedId = undefined;
        setError(completed.error ?? "The background image could not be saved.");
        return;
      }
      stagedId = undefined;
      onImageAdded(completed.image);
      onSelectImage(completed.image.id);
      setMessage("Background image added to your draft. Publish to make it visible.");
    } catch {
      if (stagedId) await discardGalleryUpload(profileId, revision, stagedId);
      setError("The background image upload failed. Try again.");
    } finally {
      setBusy(null);
      if (imageInput.current) imageInput.current.value = "";
    }
  }

  async function uploadVideo(file: File) {
    if (busy) return;
    if (file.size < 12 || file.size > 50 * 1024 * 1024) {
      setError("Choose an MP4 or WebM background clip between 12 bytes and 50 MB.");
      return;
    }
    if (file.type !== "video/mp4" && file.type !== "video/webm") {
      setError("Choose an MP4 or WebM video file.");
      return;
    }
    setBusy("video"); setError(""); setMessage("");
    let stagedId: string | undefined;
    try {
      const started = await startProfileBackgroundVideoUpload(profileId, revision, file.type, file.size);
      if ("error" in started) {
        setError(started.error ?? "Could not prepare the background video upload.");
        return;
      }
      stagedId = started.id;
      const config = supabaseConfig();
      const browser = createBrowserClient(config.url, config.key);
      const { error: uploadError } = await browser.storage.from("profile-background-incoming")
        .uploadToSignedUrl(started.path, started.token, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        await discardProfileBackgroundVideoUpload(profileId, revision, started.id);
        stagedId = undefined;
        setError("The background video could not be uploaded. Try again.");
        return;
      }
      const completed = await finishProfileBackgroundVideoUpload(profileId, revision, started.id);
      if ("error" in completed) {
        await discardProfileBackgroundVideoUpload(profileId, revision, started.id);
        stagedId = undefined;
        setError(completed.error ?? "The background video could not be saved.");
        return;
      }
      stagedId = undefined;
      setVideos((current) => [completed.asset, ...current.filter((item) => item.id !== completed.asset.id)]);
      onSelectVideo(completed.asset.id);
      setMessage("Background clip added to your draft. It will loop silently when published.");
    } catch {
      if (stagedId) await discardProfileBackgroundVideoUpload(profileId, revision, stagedId);
      setError("The background video upload failed. Try an MP4 or WebM clip up to 50 MB.");
    } finally {
      setBusy(null);
      if (videoInput.current) videoInput.current.value = "";
    }
  }

  return <section className="studio-background-uploader stack" aria-labelledby="studio-background-uploader-title">
    <div className="studio-background-upload-actions">
      <input ref={imageInput} type="file" accept={galleryTypes.join(",")} hidden
        onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file); }} />
      <input ref={videoInput} type="file" accept={videoAccept} hidden
        onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadVideo(file); }} />
      <button type="button" className="button small" disabled={busy !== null} onClick={() => imageInput.current?.click()}>
        {busy === "image" ? "Uploading image…" : "Upload background image"}
      </button>
      <button type="button" className="button small primary" disabled={busy !== null} onClick={() => videoInput.current?.click()}>
        {busy === "video" ? "Uploading clip…" : "Upload background video"}
      </button>
    </div>

    <label>Background image
      <select value={backgroundImage ?? ""} disabled={busy !== null}
        onChange={(event) => onSelectImage(event.target.value || undefined)}>
        <option value="">No image background</option>
        {gallery.map((image) => <option key={image.id} value={image.id}>{image.alt || "Gallery image"}</option>)}
      </select>
    </label>

    <label>Choose an uploaded video
      <select value={backgroundVideo ?? ""} disabled={busy !== null || loading}
        onChange={(event) => onSelectVideo(event.target.value || undefined)}>
        <option value="">No video background</option>
        {videos.map((video) => <option key={video.id} value={video.id}>
          {video.extension.toUpperCase()} · {(video.bytes / 1024 / 1024).toFixed(1)} MB
        </option>)}
      </select>
    </label>

    <p id="studio-background-uploader-title" className="muted studio-background-hint">
      Choose a still image or a silent looping MP4/WebM clip. Your selected background replaces the other type.
      Videos are limited to 50 MB and count towards your plan’s media storage.
    </p>
    {loading && <p className="muted" role="status">Loading saved clips…</p>}
    {error && <p className="message error" role="alert">{error}</p>}
    {message && <p className="message" role="status">{message}</p>}
  </section>;
}
