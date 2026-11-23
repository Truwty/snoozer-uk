"use client";

import { useEffect, useState } from "react";
import { createDiscordPresencePoller } from "@/lib/discord-presence-polling";
import { type DiscordPresencePublic } from "@/lib/discord-presence";

const labels: Record<string, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do Not Disturb",
  offline: "Offline",
  unavailable: "Unavailable",
};

function statusLabel(presence: DiscordPresencePublic) {
  return presence.state === "live" && presence.status
    ? labels[presence.status]
    : "Unavailable";
}

function tooltipText(presence: DiscordPresencePublic) {
  const lines = [`Discord status: ${statusLabel(presence)}`];
  if (presence.state !== "live") return lines.join("\n");
  if (presence.activity) {
    const activityType = presence.activity.type[0].toUpperCase() + presence.activity.type.slice(1);
    lines.push(`${activityType}: ${presence.activity.name}`);
    if (presence.activity.details) lines.push(presence.activity.details);
    if (presence.activity.state) lines.push(presence.activity.state);
  }
  if (presence.customStatus) lines.push(presence.customStatus);
  return lines.join("\n");
}

export function DiscordPresenceWidget({ username, initialPresence }: {
  username: string;
  initialPresence: DiscordPresencePublic | null;
}) {
  const [presence, setPresence] = useState(initialPresence);

  useEffect(() => {
    if (!initialPresence) return;
    const poller = createDiscordPresencePoller({
      username,
      onPresence: setPresence,
      onUnavailable: () => setPresence((current) => current
        ? { ...current, state: "unavailable", status: "unavailable", activity: null, customStatus: null, observedAt: null }
        : current),
      onDisabled: () => setPresence(null),
      isVisible: () => document.visibilityState === "visible",
    });
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void poller.refreshNow();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    void poller.start();
    return () => {
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
      poller.stop();
    };
  }, [initialPresence, username]);

  if (!presence) return null;
  const label = statusLabel(presence);
  const tooltip = tooltipText(presence);
  const state = presence.state === "live" && presence.status ? presence.status : "unavailable";

  return <span
    className="discord-presence-badge"
    data-status={state}
    data-state={presence.state}
    data-tooltip={tooltip}
    role="img"
    aria-label={`Discord status: ${label}`}
    tabIndex={0}
  >
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.7 5.4a18.6 18.6 0 0 0-4.6-1.4l-.6 1.2a17.2 17.2 0 0 0-5 0L8.9 4a18.5 18.5 0 0 0-4.6 1.4C1.4 9.7.6 13.9 1 18a18.7 18.7 0 0 0 5.6 2.8l1.2-2a12 12 0 0 1-1.9-.9l.5-.4a13.4 13.4 0 0 0 11.2 0l.5.4a12 12 0 0 1-1.9.9l1.2 2A18.7 18.7 0 0 0 23 18c.5-4.8-.8-8.9-3.3-12.6ZM8.6 15.3c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Zm6.8 0c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Z"/>
    </svg>
  </span>;
}
