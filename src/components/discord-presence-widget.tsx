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

function updatedLabel(value: string | null) {
  if (!value) return "";
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (elapsed < 60) return "Updated just now";
  if (elapsed < 3600) return `Updated ${Math.floor(elapsed / 60)}m ago`;
  return `Updated ${Math.floor(elapsed / 3600)}h ago`;
}

export function DiscordPresenceWidget({ username, initialPresence }: {
  username: string;
  initialPresence: DiscordPresencePublic | null;
}) {
  const [presence, setPresence] = useState(initialPresence);

  useEffect(() => {
    if (!initialPresence) return;
    let active = true;
    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch(`/api/v1/discord/presence?username=${encodeURIComponent(username)}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (response.status === 404) {
          if (active) setPresence(null);
          return;
        }
        if (!response.ok) return;
        const parsed = discordPresencePublic.safeParse(await response.json());
        if (active && parsed.success) setPresence(parsed.data);
      } catch {
        // Keep the last server-rendered snapshot while the network is unavailable.
      }
    };
    const timer = window.setInterval(refresh, 45_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [initialPresence, username]);

  if (!presence) return null;
  const status = presence.status ?? "unavailable";
  const title = presence.state === "unavailable" ? "Presence unavailable" : labels[status];
  return <section className="discord-presence-card" aria-label="Discord presence" data-status={status} data-state={presence.state}>
    <header className="discord-presence-header">
      <span className="discord-presence-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 8.5c2.5-1.2 5.5-1.2 8 0l1.1 7.2c-2 1.6-8.2 1.6-10.2 0L8 8.5Z"/>
          <path d="M9 9 7.8 6.8M15 9l1.2-2.2M9.5 13h.01M14.5 13h.01M9 16c1.8.9 4.2.9 6 0"/>
        </svg>
      </span>
      <span className="discord-presence-heading">
        <span className="discord-presence-eyebrow">DISCORD PRESENCE</span>
        <strong>{title}</strong>
      </span>
      <span className="discord-presence-dot" aria-hidden="true"/>
    </header>
    {presence.activity && presence.state === "live" && <div className="discord-presence-activity">
      <span className="discord-presence-activity-type">{presence.activity.type}</span>
      <strong>{presence.activity.name}</strong>
      {presence.activity.details && <span>{presence.activity.details}</span>}
      {presence.activity.state && <span>{presence.activity.state}</span>}
    </div>}
    {presence.customStatus && presence.state === "live" && <p className="discord-presence-custom">{presence.customStatus}</p>}
    <footer className="discord-presence-footer">
      <span>{presence.state === "live" ? updatedLabel(presence.observedAt) : "Waiting for a fresh Discord update"}</span>
      <span>Discord</span>
    </footer>
  </section>;
}
