import Link from "next/link";
import { readStudioDraft, studioHref, type StudioProfileQuery } from "@/lib/profiles-server";
import { sessionClient } from "@/lib/supabase";
import { discordPresenceSettings } from "@/lib/discord-presence";
import { discordPresenceInviteUrl } from "@/lib/env";
import { connectDiscordPresence, disconnectDiscordPresence, saveDiscordPresenceSettings } from "./actions";

export const metadata = { title: "Discord Presence · Studio", robots: { index: false, follow: false } };

type Query = StudioProfileQuery & {
  saved?: string;
  linked?: string;
  disconnected?: string;
  error?: string;
};

const errors: Record<string, string> = {
  profile: "Choose a valid profile before changing Discord Presence.",
  disabled: "Discord Presence has not been activated yet. It will be enabled after the Discord bot, worker and policy review are complete.",
  link: "Discord could not be linked. If you already use email sign-in, manual identity linking may need to be enabled in Supabase Auth settings.",
  connect: "Connect a Discord account to this Snoozer account before enabling presence.",
  fields: "Select at least one field to share, or turn public presence off.",
  save: "Your Discord Presence settings could not be saved. Please try again.",
  disconnect: "Discord Presence could not be disconnected. Please try again.",
};

export default async function Page({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  if (process.env.DISCORD_PRESENCE_ENABLED !== "true") return <main className="shell"><nav className="nav studio-subnav"><Link className="button small" href="/studio">Back to Studio</Link></nav><section className="panel stack discord-settings-panel"><p className="eyebrow">STUDIO / INTEGRATIONS</p><h1>Discord Presence</h1><p className="muted">This integration is prepared but not activated. No Discord presence data is being collected or displayed.</p><div className="discord-service-status"><span className="discord-service-indicator" aria-hidden="true"/><span>Activation is pending Discord policy clearance, bot credentials, a shared server and an always-on worker.</span></div></section></main>;
  const draft = await readStudioDraft(query.profile);
  const client = await sessionClient();
  const response = draft
    ? await client.rpc("discord_presence_get_my_settings", { p_profile: draft.profile_id })
    : null;
  const settings = response && !response.error ? discordPresenceSettings.safeParse(response.data) : null;
  const invite = discordPresenceInviteUrl();

  return <main className="shell">
    <nav className="nav studio-subnav">
      <Link className="button small" href={studioHref("/studio", draft?.profile_id)}>Back to Studio</Link>
    </nav>
    <section className="panel stack discord-settings-panel">
      <p className="eyebrow">STUDIO / INTEGRATIONS</p>
      <h1>Discord Presence</h1>
      <p className="muted">Show your live Discord status and selected activity on your published Snoozer profile. This is optional and off until you enable it.</p>

      {query.saved === "1" && <p className="message success" role="status">Discord Presence settings saved.</p>}
      {query.linked === "1" && <p className="message success" role="status">Discord identity linked to your current Snoozer account.</p>}
      {query.disconnected === "1" && <p className="message success" role="status">Discord Presence disconnected. Your saved profile choices remain off.</p>}
      {query.error && <p className="message error" role="alert">{errors[query.error] ?? "Something went wrong. Please try again."}</p>}

      {!draft ? <div className="stack">
        <p>You need to claim a Snoozer profile before configuring public presence.</p>
        <Link className="button primary" href="/studio">Open Studio</Link>
      </div> : !settings?.success ? <p role="alert">Discord Presence settings are temporarily unavailable. Reload the page to try again.</p> : <>
        <div className="discord-settings-profile">
          <span className="muted">Selected profile</span>
          <strong>@{draft.username}</strong>
        </div>

        <div className="discord-settings-connection">
          <div className="stack">
            <strong>{settings.data.connected ? "Discord account connected" : "Discord account not connected"}</strong>
            <p className="muted">{settings.data.connected
              ? "Your Discord identity is linked to this Snoozer account. Presence is read-only; Snoozer cannot change your Discord account."
              : "Connect your Discord identity to prove which Discord account the bot should observe. Snoozer never asks for your Discord password or bot token."}</p>
          </div>
          {!settings.data.connected && <form action={connectDiscordPresence}>
            <input type="hidden" name="profileId" value={draft.profile_id}/>
            <button className="button primary" type="submit">Connect Discord</button>
          </form>}
        </div>

        {invite && <p className="muted">The presence bot can only see activity from members of the shared Snoozer Discord server. <a href={invite} target="_blank" rel="noopener noreferrer">Join the Snoozer Discord server</a>.</p>}
        {!invite && <p className="muted">To share live presence, your Discord account must be in the server where Snoozer's presence bot is installed. The server invite will be provided when the bot is configured.</p>}

        <div className={settings.data.serviceReady ? "discord-service-status is-ready" : "discord-service-status"} role="status">
          <span className="discord-service-indicator" aria-hidden="true"/>
          <span>{settings.data.serviceReady
            ? "Snoozer Presence service is connected."
            : "Snoozer Presence worker is not online yet. Your settings can be saved, but the public widget will show as unavailable until the bot is running."}</span>
        </div>

        <form action={saveDiscordPresenceSettings} className="stack discord-settings-form">
          <input type="hidden" name="profileId" value={draft.profile_id}/>
          <label className="discord-setting-toggle">
            <input type="checkbox" name="enabled" defaultChecked={settings.data.enabled} disabled={!settings.data.connected}/>
            <span><strong>Show Discord Presence on this profile</strong><small>Visitors can see the fields you select below when this profile is published.</small></span>
          </label>
          <fieldset className="discord-settings-fields" disabled={!settings.data.connected}>
            <legend>What visitors can see</legend>
            <label className="discord-setting-toggle">
              <input type="checkbox" name="showStatus" defaultChecked={settings.data.showStatus}/>
              <span><strong>Online status</strong><small>Online, Idle, Do Not Disturb or Offline.</small></span>
            </label>
            <label className="discord-setting-toggle">
              <input type="checkbox" name="showActivity" defaultChecked={settings.data.showActivity}/>
              <span><strong>Current activity</strong><small>Game, streaming, listening or other activity text supplied by Discord.</small></span>
            </label>
            <label className="discord-setting-toggle">
              <input type="checkbox" name="showCustomStatus" defaultChecked={settings.data.showCustomStatus}/>
              <span><strong>Custom status</strong><small>Off by default. Only displayed when you explicitly enable it.</small></span>
            </label>
          </fieldset>
          <p className="muted">Enabling this setting is your permission to display the selected Discord presence data publicly on this profile. You can switch it off at any time. Presence is not a Premium-only feature.</p>
          <button className="button primary" type="submit" disabled={!settings.data.connected}>Save Discord Presence</button>
        </form>

        {settings.data.connected && <form action={disconnectDiscordPresence}>
          <input type="hidden" name="profileId" value={draft.profile_id}/>
          <button className="button" type="submit">Disconnect Discord Presence</button>
          <p className="muted">This removes the Snoozer presence link and cached activity. It does not unlink Discord as a sign-in method for your Snoozer account.</p>
        </form>}
      </>}
    </section>
  </main>;
}
