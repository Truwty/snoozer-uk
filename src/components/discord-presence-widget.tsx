"use client";

import { useEffect, useState } from "react";
import { discordPresencePublic, type DiscordPresencePublic } from "@/lib/discord-presence";

const labels: Record<string, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do Not Disturb",
  offline: "Offline",
  unavailable: "Unavailable",
};

export function DiscordPresenceWidget({ username, initialPresence }: {
  username: string;
  initialPresence: DiscordPresencePublic | null;
}) {
  const [presence, setPresence] = useState(initialPresence);

  useEffect(() => {
    if (!initialPresence) return;
    let active = true;
    const timerRef: { value?: number } = {};
    let refresh: () => Promise<void> = async () => {};
    const stopPolling = () => {
      if (timerRef.value !== undefined) window.clearInterval(timerRef.value);
      document.removeEventListener("visibilitychange", refresh);
    };
    const markUnavailable = () => {
      if (active) setPresence({ ...initialPresence, state: "unavailable", status: null, activity: null, customStatus: null, observedAt: null });
    };
    refresh = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch(`/api/v1/discord/presence?username=${encodeURIComponent(username)}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (response.status === 404) {
          if (active) setPresence(null);
          stopPolling();
          return;
        }
        if (!response.ok) {
          markUnavailable();
          return;
        }
        const parsed = discordPresencePublic.safeParse(await response.json());
        if (parsed.success) {
          if (active) setPresence(parsed.data);
        } else {
          markUnavailable();
        }
      } catch {
        markUnavailable();
      }
    };
    timerRef.value = window.setInterval(refresh, 45_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      stopPolling();
    };
  }, [initialPresence, username]);

  if (!presence) return null;
  const live = presence.state === "live";
  const statusLabel = presence.status ? labels[presence.status] : live
    ? presence.activity || presence.customStatus ? "Active" : "Connected"
    : "Unavailable";
  return <section className="discord-presence-card" aria-label="Discord presence"
    data-status={presence.status ?? "hidden"} data-state={presence.state}>
    <header className="discord-presence-header">
      <span className="discord-presence-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.7 5.4a18.6 18.6 0 0 0-4.6-1.4l-.6 1.2a17.2 17.2 0 0 0-5 0L8.9 4a18.5 18.5 0 0 0-4.6 1.4C1.4 9.7.6 13.9 1 18a18.7 18.7 0 0 0 5.6 2.8l1.2-2a12 12 0 0 1-1.9-.9l.5-.4a13.4 13.4 0 0 0 11.2 0l.5.4a12 12 0 0 1-1.9.9l1.2 2A18.7 18.7 0 0 0 23 18c.5-4.8-.8-8.9-3.3-12.6ZM8.6 15.3c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Zm6.8 0c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Z"/>
        </svg>
      </span>
      <span className="discord-presence-heading">
        <span className="discord-presence-eyebrow">LIVE PROFILE STATUS</span>
        <strong>Discord presence</strong>
      </span>
      <span className="discord-presence-state">
        <span className="discord-presence-dot" aria-hidden="true"/>
        {statusLabel}
      </span>
    </header>
    {presence.activity && live && <div className="discord-presence-activity">
      <span className="discord-presence-activity-type">{presence.activity.type}</span>
      <div className="discord-presence-activity-copy">
        <strong>{presence.activity.name}</strong>
        {presence.activity.details && <span>{presence.activity.details}</span>}
        {presence.activity.state && <span>{presence.activity.state}</span>}
      </div>
    </div>}
    {presence.customStatus && live && <p className="discord-presence-custom">{presence.customStatus}</p>}
    <footer className="discord-presence-footer">
      <span className="discord-presence-live-mark" aria-hidden="true"/>
      <span>{live ? "Live from Discord" : "Waiting for a fresh Discord update"}</span>
    </footer>
  </section>;
}
