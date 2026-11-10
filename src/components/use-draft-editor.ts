"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadSavedDraft, save } from "@/app/studio/actions";
import { initialState, type ActionState } from "@/lib/actions";
import { profileContent, type DraftProfile, type ProfileContent } from "@/lib/profile";

type Edits = { revision: number; content: ProfileContent; removeAvatar: boolean };

export function useDraftEditor(draft: DraftProfile) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState<DraftProfile>();
  const [edits, setEdits] = useState<Edits | null>(null);
  const [message, setMessage] = useState<ActionState>(initialState);
  const [conflicted, setConflicted] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const failed = useRef<Edits | null>(null);
  const saved = confirmed && confirmed.revision > draft.revision ? confirmed : draft;
  const conflict = conflicted || Boolean(edits && edits.revision !== saved.revision);

  function edit(update: (current: Edits) => Edits) {
    setEdits((current) => update(current ?? { revision: saved.revision, content: saved, removeAvatar: false }));
    setMessage(initialState);
  }

  const commit = useCallback(async (intent: "draft" | "publish") => {
    if (busy.current || conflict) return;
    const snapshot = edits ?? { revision: saved.revision, content: saved, removeAvatar: false };
    const content = profileContent.safeParse(snapshot.content);
    if (!content.success) {
      setMessage({ status: "error", message: content.error.issues[0].message });
      return;
    }
    busy.current = true;
    setPending(true);
    setMessage(initialState);
    try {
      const result = await save({
        revision: snapshot.revision, intent, removeAvatar: snapshot.removeAvatar, content: content.data,
      });
      if (result.status === "error") {
        failed.current = edits;
        if (result.conflict) setConflicted(true);
        else setMessage(result);
        return;
      }

      setConfirmed({
        ...saved, ...result.content, revision: result.revision,
        avatar: snapshot.removeAvatar ? null : saved.avatar,
        published_revision: intent === "publish" ? result.revision : saved.published_revision,
      });
      // Edits made during the request start from this write, never from a newer server response.
      setEdits((current) => {
        if (!current || current === edits) return null;
        return { ...current, revision: result.revision, removeAvatar: snapshot.removeAvatar ? false : current.removeAvatar };
      });
      failed.current = null;
      setMessage({ status: "success", message: intent === "publish" ? "Your page is live." : "Draft saved." });
    } catch {
      failed.current = edits;
      setMessage({ status: "error", message: "Couldn’t confirm the save. Try again or load the saved draft." });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }, [conflict, edits, saved]);

  useEffect(() => {
    if (!edits || pending || conflict || edits.removeAvatar || failed.current === edits
      || !profileContent.safeParse(edits.content).success) return;
    const timer = window.setTimeout(() => void commit("draft"), 1000);
    return () => window.clearTimeout(timer);
  }, [commit, conflict, edits, pending]);

  useEffect(() => {
    if (!edits) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [edits]);

  async function discardAndReload() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      const latest = await loadSavedDraft();
      setConfirmed(latest ?? undefined);
      setEdits((current) => current === edits ? null : current);
      setConflicted(false);
      failed.current = null;
      setMessage({ status: "success", message: "Loaded your saved draft." });
      router.refresh();
    } catch {
      setMessage({ status: "error", message: "Couldn’t load the saved draft. Your edits are still here." });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return { saved, edits, edit, pending, conflict, message, commit, discardAndReload };
}
