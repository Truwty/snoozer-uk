import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { requireAccount } from "@/lib/profiles-server";
import { accountPlan } from "@/lib/entitlements";
import { z } from "zod";
import { AccountSecurityMfa } from "@/components/account-security-mfa";
import { EmailChangeForm } from "@/components/email-change-form";
import { linkGoogleIdentity } from "@/app/auth/actions";
import { revokeDeviceSession, disableAccountMfa, unlinkSignInIdentity, updateMarketingPreference } from "./actions";
import { deviceLabel } from "@/lib/account-security";

export const metadata = { title: "Account Settings", robots: { index: false, follow: false } };

function maskEmail(value: string) {
  const [local, domain] = value.split("@");
  if (!domain) return "••••••••";
  const visible = local.slice(0, 1);
  return visible + "•".repeat(Math.max(5, Math.min(12, local.length + 2))) + "@" + domain;
}

export default async function AccountSettings({ searchParams }: { searchParams: Promise<{ email?: string; google?: string; session?: string; mfa?: string; identity?: string; marketing?: string }> }) {
  const status = await searchParams;
  const { client, user } = await requireAccount();
  const [planResponse, sessionResponse, factorResponse, marketingResponse] = await Promise.all([
    client.rpc("get_my_plan"), client.rpc("list_my_device_sessions"), client.auth.mfa.listFactors(), client.rpc("get_my_marketing_preference"),
  ]);
  const plan = accountPlan.safeParse(planResponse.data);
  const appMetadata = user.app_metadata as Record<string, unknown>;
  const configuredProviders = Array.isArray(appMetadata.providers)
    ? appMetadata.providers.filter((provider): provider is string => typeof provider === "string")
    : typeof appMetadata.provider === "string" ? [appMetadata.provider] : [];
  const identities = user.identities ?? [];
  const discordSignIn = configuredProviders.includes("discord") || identities.some((identity) => identity.provider === "discord");
  const googleSignIn = configuredProviders.includes("google") || identities.some((identity) => identity.provider === "google");
  const verifiedTotp = factorResponse.data?.totp?.filter((factor) => factor.status === "verified") ?? [];
  const deviceSessions = z.array(z.object({
    session_id: z.uuid(), created_at: z.string(), refreshed_at: z.string().nullable(), last_active_at: z.string().nullable(),
    user_agent: z.string().nullable(), tag: z.string().nullable(), aal: z.string(), is_current: z.boolean(), expires_at: z.string().nullable(),
  })).safeParse(sessionResponse.data);
  const maskedEmail = user.email ? maskEmail(user.email) : "No email on file";
  const marketing = z.object({ emailOptIn: z.boolean(), consentUpdatedAt: z.iso.datetime({ offset: true }).nullable() })
    .safeParse(marketingResponse.data);

  return <main className="shell studio-shell studio-account-page">
    {status.email === "confirmation" && <p role="status">An email-change confirmation has been recorded. With secure email change enabled, Supabase may require verification from both your current and new inboxes. Check the email shown above after completing all requested confirmations.</p>}
    {status.email === "changed" && <p role="status">Your email address has been updated.</p>}
    {status.google === "linked" && <p role="status">Google is now linked to this Snoozer account.</p>}
    {status.google === "failed" && <p role="alert">Google linking could not be completed. The existing account was not changed.</p>}
    {status.google === "unavailable" && <p role="alert">Google linking is temporarily unavailable.</p>}
    {status.session === "revoked" && <p role="status">The selected device session has been signed out.</p>}
    {status.session === "failed" && <p role="alert">That session could not be revoked. Refresh the list and try again.</p>}
    {status.mfa === "disabled" && <p role="status">Authenticator MFA has been removed.</p>}
    {status.mfa === "failed" && <p role="alert">MFA could not be removed.</p>}
    {status.identity === "unlinked" && <p role="status">The selected sign-in identity has been unlinked.</p>}
    {status.identity === "last" && <p role="alert">Keep at least one other sign-in identity connected before unlinking this one.</p>}
    {status.identity === "presencefailed" && <p role="alert">Discord presence could not be disconnected, so the Discord identity was left linked.</p>}
    {status.identity && !["unlinked", "last", "presencefailed"].includes(status.identity) && <p role="alert">The sign-in identity could not be unlinked. It may already be disconnected or require account-provider configuration.</p>}
    {status.marketing === "saved" && <p role="status">Your marketing email preference has been saved.</p>}
    {status.marketing && status.marketing !== "saved" && <p role="alert">Your marketing preference could not be updated. Refresh and try again.</p>}
    <header className="studio-page-heading">
      <div><p className="eyebrow">ACCOUNT / SETTINGS</p><h1>Account Settings</h1>
        <p className="muted">Manage your Snoozer sign-in details, security options and account preferences.</p></div>
    </header>

    <section className="studio-dashboard-panel studio-account-settings-section">
      <div className="studio-panel-heading"><div><p className="eyebrow">GENERAL INFORMATION</p><h2>Your account</h2><p className="muted">Your verified sign-in identity and account status.</p></div>
        <span className="studio-setting-status is-good">Verified</span></div>
      <div className="studio-setting-row">
        <div><strong>Email address</strong><p>{maskedEmail}</p></div>
        <details className="studio-reveal-email"><summary>Show email</summary><p>{user.email ?? "No email address is currently available."}</p></details>
      </div>
      <div className="studio-setting-row">
        <div><strong>Email verification</strong><p>Your account has a confirmed email address.</p></div>
        <span className="studio-setting-status is-good">Confirmed</span>
      </div>
      <div className="studio-setting-row">
        <div><strong>Account ID</strong><p className="studio-account-id">{user.id}</p></div>
        <span className="studio-setting-caption">Private reference</span>
      </div>
      <details className="studio-email-change"><summary>Change email address</summary>
        <EmailChangeForm/>
      </details>
    </section>

    <section className="studio-dashboard-panel studio-account-settings-section">
      <div className="studio-panel-heading"><div><p className="eyebrow">SECURITY</p><h2>Password and sign-in</h2><p className="muted">Keep access to your account secure.</p></div></div>
      <div className="studio-setting-row">
        <div><strong>Password</strong><p>Request a secure password-reset link by email. Changing your password revokes existing Supabase sessions.</p></div>
        <Link className="button small" href="/forgot-password">Change password ↗</Link>
      </div>
      <div className="studio-setting-row studio-setting-row--stack">
        <div><strong>Authenticator MFA</strong><p>Use a time-based one-time password from an authenticator app. Snoozer asks for a code when you sign in and protects Owner-level operations with AAL2.</p></div>
        <div className="studio-account-security-control">
          <AccountSecurityMfa verifiedFactorId={verifiedTotp[0]?.id}/>
          {verifiedTotp.map((factor) => <form key={factor.id} action={disableAccountMfa}>
            <input type="hidden" name="factorId" value={factor.id}/>
            <button className="button small studio-danger-button" type="submit">Remove authenticator</button>
          </form>)}
        </div>
      </div>
      <div className="studio-setting-row studio-setting-row--stack">
        <div><strong>Devices and active sessions</strong><p>Review where this account is signed in. Revoking a device prevents that session from refreshing. Its previously issued access token remains valid only until its short expiry; the current device is protected from accidental self-revocation.</p></div>
        <div className="studio-device-sessions">
          {deviceSessions.success ? deviceSessions.data.length ? deviceSessions.data.map((session) => <article className="studio-device-session" key={session.session_id}>
            <div><strong>{deviceLabel(session.user_agent)}</strong>
              <p className="muted">{session.is_current ? "Current device" : "Other device"} · Last active {new Date(session.last_active_at ?? session.created_at).toLocaleString("en-GB")}</p>
              <p className="muted">Signed in {new Date(session.created_at).toLocaleString("en-GB")} · Assurance {session.aal.toUpperCase()}</p>
            </div>
            {session.is_current ? <span className="studio-setting-status is-good">This device</span> : <form action={revokeDeviceSession}>
              <input type="hidden" name="session" value={session.session_id}/>
              <button className="button small studio-danger-button" type="submit">Sign out device</button>
            </form>}
          </article>) : <p>No active sessions were found.</p> : <p role="alert">Device sessions are temporarily unavailable.</p>}
        </div>
      </div>
    </section>

    <section className="studio-dashboard-panel studio-account-settings-section">
      <div className="studio-panel-heading"><div><p className="eyebrow">CONNECTED SERVICES</p><h2>Connections</h2><p className="muted">Sign-in identities and profile integrations are separate permissions.</p></div></div>
      <div className="studio-setting-row">
        <div><strong>Discord sign-in</strong><p>{discordSignIn ? "Discord is listed as a sign-in provider for this Snoozer account." : "This Snoozer account is not currently using Discord sign-in."}</p></div>
        {discordSignIn && identities.length > 1 ? <form action={unlinkSignInIdentity} className="stack">
          <input type="hidden" name="provider" value="discord"/><label className="check"><input type="checkbox" name="confirm_unlink" required/> I understand I will no longer sign in with Discord.</label>
          <button className="button small studio-danger-button" type="submit">Unlink Discord sign-in</button>
        </form> : <span className={"studio-setting-status" + (discordSignIn ? " is-good" : "")}>{discordSignIn ? identities.length < 2 ? "Keep as only sign-in" : "Connected" : "Not linked"}</span>}
      </div>
      <div className="studio-setting-row">
        <div><strong>Google sign-in</strong><p>{googleSignIn ? "Google is linked to this Snoozer account. You can use either sign-in method." : "Link a Google identity to sign in without changing your Snoozer account or profile."}</p></div>
        {googleSignIn && identities.length > 1 ? <form action={unlinkSignInIdentity} className="stack">
          <input type="hidden" name="provider" value="google"/><label className="check"><input type="checkbox" name="confirm_unlink" required/> I understand I will no longer sign in with Google.</label>
          <button className="button small studio-danger-button" type="submit">Unlink Google sign-in</button>
        </form> : googleSignIn ? <span className="studio-setting-status is-good">Keep as only sign-in</span>
          : <form action={linkGoogleIdentity}><button className="button small" type="submit">Link Google account</button></form>}
      </div>
      <div className="studio-setting-row">
        <div><strong>Discord Presence</strong><p>Control the live Discord activity that may appear on your public profile. This is not the same as account sign-in.</p></div>
        <Link className="button small" href="/studio/discord">Presence settings ↗</Link>
      </div>
      <div className="studio-setting-row">
        <div><strong>Spotify embeds</strong><p>Add official Spotify players to your profile without connecting a Spotify account.</p></div>
        <Link className="button small" href="/studio/spotify">Embed guide ↗</Link>
      </div>
    </section>

    <section className="studio-dashboard-panel studio-account-settings-section">
      <div className="studio-panel-heading"><div><p className="eyebrow">PREFERENCES</p><h2>Notifications and your data</h2><p className="muted">Manage important notices and privacy requests.</p></div></div>
      <div className="studio-setting-row">
        <div><strong>Account notifications</strong><p>Read important notices about actions affecting your Snoozer account.</p></div>
        <Link className="button small" href="/account/notifications">Open notifications ↗</Link>
      </div>
      <div className="studio-setting-row">
        <div><strong>Personal data</strong><p>Request an export of your account data or submit an account deletion request.</p></div>
        <Link className="button small" href="/account/data">Manage your data ↗</Link>
      </div>
      <div className="studio-setting-row studio-setting-row--stack">
        <div><strong>Email marketing</strong><p>Choose whether Snoozer may email you product news and offers. Account, security and billing messages are unaffected.</p></div>
        {marketing.success ? <form action={updateMarketingPreference} className="studio-marketing-preference">
          <label>Email me product news and offers
            <select name="email_opt_in" defaultValue={String(marketing.data.emailOptIn)} aria-label="Marketing email preference">
              <option value="false">Off</option><option value="true">On</option>
            </select>
          </label>
          <button className="button small" type="submit">Save preference</button>
          {marketing.data.consentUpdatedAt && <small className="muted">Last changed {new Date(marketing.data.consentUpdatedAt).toLocaleString("en-GB")}</small>}
        </form> : <p role="alert">Marketing preferences are temporarily unavailable.</p>}
      </div>
    </section>

    <section className="studio-dashboard-panel studio-account-settings-section">
      <div className="studio-panel-heading"><div><p className="eyebrow">ACCOUNT ACTIONS</p><h2>Account and plan</h2></div></div>
      <div className="studio-setting-row">
        <div><strong>Current plan</strong><p>{plan.success ? plan.data.plan.toUpperCase() : "Plan details are unavailable."}</p></div>
        <Link className="button small" href="/studio/plan">Manage plan ↗</Link>
      </div>
      <div className="studio-setting-row">
        <div><strong>Gift links</strong><p>Redeem a one-time Premium gift sent to you by a Snoozer Owner.</p></div>
        <Link className="button small" href="/gift">Claim a gift ↗</Link>
      </div>
      <form className="studio-logout-row" action={signOut}>
        <div><strong>Log out</strong><p>Sign out of this account on this browser.</p></div>
        <button className="button studio-danger-button" type="submit">Logout</button>
      </form>
    </section>
  </main>;
}
