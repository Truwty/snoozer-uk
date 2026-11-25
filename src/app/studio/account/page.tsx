import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { requireAccount } from "@/lib/profiles-server";
import { accountPlan } from "@/lib/entitlements";

export const metadata = { title: "Account Settings", robots: { index: false, follow: false } };

function maskEmail(value: string) {
  const [local, domain] = value.split("@");
  if (!domain) return "••••••••";
  const visible = local.slice(0, 1);
  return visible + "•".repeat(Math.max(5, Math.min(12, local.length + 2))) + "@" + domain;
}

export default async function AccountSettings() {
  const { client, user } = await requireAccount();
  const planResponse = await client.rpc("get_my_plan");
  const plan = accountPlan.safeParse(planResponse.data);
  const appMetadata = user.app_metadata as Record<string, unknown>;
  const configuredProviders = Array.isArray(appMetadata.providers)
    ? appMetadata.providers.filter((provider): provider is string => typeof provider === "string")
    : typeof appMetadata.provider === "string" ? [appMetadata.provider] : [];
  const discordSignIn = configuredProviders.includes("discord");
  const googleSignIn = configuredProviders.includes("google");
  const maskedEmail = user.email ? maskEmail(user.email) : "No email on file";

  return <main className="shell studio-shell studio-account-page">
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
      <p className="studio-settings-footnote">Changing the email address is not yet supported by Snoozer’s account settings flow. Contact support before changing the address attached to an account.</p>
      <Link className="button small" href="/help/contact">Contact support about account details ↗</Link>
    </section>

    <section className="studio-dashboard-panel studio-account-settings-section">
      <div className="studio-panel-heading"><div><p className="eyebrow">SECURITY</p><h2>Password and sign-in</h2><p className="muted">Keep access to your account secure.</p></div></div>
      <div className="studio-setting-row">
        <div><strong>Password</strong><p>Request a secure password-reset link by email. Changing your password revokes existing Supabase sessions.</p></div>
        <Link className="button small" href="/forgot-password">Change password ↗</Link>
      </div>
      <div className="studio-setting-row">
        <div><strong>Multi-factor authentication</strong><p>Authenticator-app enrolment and recovery-code management are not enabled in Snoozer yet.</p></div>
        <span className="studio-setting-status">Not available</span>
      </div>
      <div className="studio-setting-row">
        <div><strong>Active sessions</strong><p>Studio supports switching between up to four accounts saved in this browser. It does not currently provide a device-by-device session history.</p></div>
        <a className="button small" href="#studio-account-menu">Open account switcher ↓</a>
      </div>
    </section>

    <section className="studio-dashboard-panel studio-account-settings-section">
      <div className="studio-panel-heading"><div><p className="eyebrow">CONNECTED SERVICES</p><h2>Connections</h2><p className="muted">Sign-in identities and profile integrations are separate permissions.</p></div></div>
      <div className="studio-setting-row">
        <div><strong>Discord sign-in</strong><p>{discordSignIn ? "Discord is listed as a sign-in provider for this Snoozer account." : "This Snoozer account is not currently using Discord sign-in."}</p></div>
        <span className={"studio-setting-status" + (discordSignIn ? " is-good" : "")}>{discordSignIn ? "Connected" : "Not linked"}</span>
      </div>
      <div className="studio-setting-row">
        <div><strong>Google sign-in</strong><p>{googleSignIn ? "Google is listed as a sign-in provider for this Snoozer account." : "Google account linking is not configured for Snoozer yet."}</p></div>
        <span className="studio-setting-status">{googleSignIn ? "Connected" : "Unavailable"}</span>
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
      <div className="studio-setting-row">
        <div><strong>Email marketing</strong><p>Optional marketing preference controls are not currently available in the account dashboard.</p></div>
        <span className="studio-setting-status">Not available</span>
      </div>
    </section>

    <section className="studio-dashboard-panel studio-account-settings-section">
      <div className="studio-panel-heading"><div><p className="eyebrow">ACCOUNT ACTIONS</p><h2>Account and plan</h2></div></div>
      <div className="studio-setting-row">
        <div><strong>Current plan</strong><p>{plan.success ? plan.data.plan.toUpperCase() : "Plan details are unavailable."}</p></div>
        <Link className="button small" href="/studio/plan">Manage plan ↗</Link>
      </div>
      <div className="studio-setting-row">
        <div><strong>Gift links</strong><p>Gift-link purchasing and management are not currently available in Snoozer.</p></div>
        <span className="studio-setting-status">Not available</span>
      </div>
      <form className="studio-logout-row" action={signOut}>
        <div><strong>Log out</strong><p>Sign out of this account on this browser.</p></div>
        <button className="button studio-danger-button" type="submit">Logout</button>
      </form>
    </section>
  </main>;
}
