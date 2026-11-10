"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadSavedDraft, save } from "@/app/studio/actions";
import { initialState, type ActionState } from "@/lib/actions";
import { profileContent, type DraftProfile, type ProfileContent } from "@/lib/profile";

type Edits = { revision: number; content: ProfileContent; removeAvatar: boolean };
type EditorState = {
  edits: Edits | null;
  past: ProfileContent[];
  future: ProfileContent[];
  historyRevision: number;
};

function emptyEditor(historyRevision: number): EditorState {
  return { edits: null, past: [], future: [], historyRevision };
}

export function useDraftEditor(draft: DraftProfile) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState<DraftProfile>();
  const [editor, setEditor] = useState(() => emptyEditor(draft.revision));
  const { edits } = editor;
  const [message, setMessage] = useState<ActionState>(initialState);
  const [conflicted, setConflicted] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const failed = useRef<Edits | null>(null);
  const saved = confirmed && confirmed.revision > draft.revision ? confirmed : draft;
  const conflict = conflicted || Boolean(edits && edits.revision !== saved.revision);

  const historyCurrent = Boolean(edits) || editor.historyRevision === saved.revision;

  function edit(update: (current: Edits) => Edits) {
    setEditor((current) => {
      const state = current.edits || current.historyRevision === saved.revision ? current : emptyEditor(saved.revision);
      const previous = state.edits ?? { revision: saved.revision, content: saved, removeAvatar: false };
      const next = update(previous);
      if (next.content === previous.content) return { ...state, edits: next };
      return { ...state, edits: next, past: [...state.past.slice(-29), previous.content], future: [] };
    });
    setMessage(initialState);
  }

  function travel(direction: "undo" | "redo") {
    if (!historyCurrent) return;
    setEditor((current) => {
      const previous = current.edits ?? { revision: saved.revision, content: saved, removeAvatar: false };
      if (direction === "undo") {
        const content = current.past.at(-1);
        return content ? {
          ...current, edits: { ...previous, content }, past: current.past.slice(0, -1),
          future: [...current.future, previous.content],
        } : current;
      }
      const content = current.future.at(-1);
      return content ? {
        ...current, edits: { ...previous, content }, past: [...current.past, previous.content],
        future: current.future.slice(0, -1),
      } : current;
    });
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
      setEditor((current) => ({
        ...current, historyRevision: result.revision,
        edits: current.edits && current.edits !== edits
          ? { ...current.edits, revision: result.revision, removeAvatar: snapshot.removeAvatar ? false : current.edits.removeAvatar }
          : null,
      }));
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
      setEditor((current) => current.edits === edits ? emptyEditor(latest?.revision ?? saved.revision) : current);
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

  return {
    saved, edits, edit, pending, conflict, message, commit, discardAndReload, travel,
    canUndo: historyCurrent && editor.past.length > 0,
    canRedo: historyCurrent && editor.future.length > 0,
  };
}
