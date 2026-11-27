import Link from "next/link";
import { signOut, linkGoogleIdentity } from "@/app/auth/actions";
import { readStudioDraft, requireAccount } from "@/lib/profiles-server";
import { aliasInventory } from "@/lib/aliases";
import { ProfileAliases } from "@/components/profile-aliases";
import { ProfileUsernameChange } from "@/components/profile-username-change";
import { z } from "zod";
import { AccountSecurityMfa } from "@/components/account-security-mfa";
import { AccountRecoveryCodes } from "@/components/account-recovery-codes";
import { EmailChangeForm } from "@/components/email-change-form";
import { disableAccountMfa, unlinkSignInIdentity, updateMarketingPreference, revokeDeviceSession } from "./actions";
import { AccountLanguageSelect } from "@/components/account-language-select";
import { accountLocale, accountLocales, accountLabel } from "@/lib/account-locale";
import { deviceLabel } from "@/lib/account-security";

export const metadata = { title: "Account Settings", robots: { index: false, follow: false } };

function maskEmail(value: string) {
  const [local, domain] = value.split("@");
  if (!domain) return "••••••••";
  const visible = local.slice(0, 1);
  return visible + "•".repeat(Math.max(5, Math.min(12, local.length + 2))) + "@" + domain;
}

export default async function AccountSettings({ searchParams }: { searchParams: Promise<{ email?: string; google?: string; session?: string; mfa?: string; identity?: string; marketing?: string; language?: string }> }) {
  const status = await searchParams;
  const { client, user } = await requireAccount();
  const draft = await readStudioDraft(undefined);
  const [sessionResponse, factorResponse, marketingResponse, aliasResponse, giftsResponse] = await Promise.all([
    client.rpc("list_my_device_sessions"), client.auth.mfa.listFactors(), client.rpc("get_my_marketing_preference"),
    draft ? client.rpc("list_my_aliases", { p_profile: draft.profile_id }) : Promise.resolve({ data: null, error: null }),
    client.rpc("list_my_stripe_sandbox_gifts"),
  ]);
  const appMetadata = user.app_metadata as Record<string, unknown>;
  const configuredProviders = Array.isArray(appMetadata.providers)
    ? appMetadata.providers.filter((provider): provider is string => typeof provider === "string")
    : typeof appMetadata.provider === "string" ? [appMetadata.provider] : [];
  const identities = user.identities ?? [];
  const discordSignIn = configuredProviders.includes("discord") || identities.some((identity) => identity.provider === "discord");
  const googleSignIn = configuredProviders.includes("google") || identities.some((identity) => identity.provider === "google");
  const verifiedTotp = factorResponse.data?.totp?.filter((factor) => factor.status === "verified") ?? [];
  const aliases = aliasInventory.safeParse(aliasResponse.data);
  const sessions = z.array(z.object({
    session_id:z.uuid(),created_at:z.string(),refreshed_at:z.string().nullable(),last_active_at:z.string().nullable(),
    user_agent:z.string().nullable(),tag:z.string().nullable(),aal:z.string(),is_current:z.boolean(),expires_at:z.string().nullable(),
  })).safeParse(sessionResponse.data);
  const marketing = z.object({emailOptIn:z.boolean(),consentUpdatedAt:z.iso.datetime({offset:true}).nullable()}).safeParse(marketingResponse.data);
  const gifts = z.array(z.object({
    order_id:z.uuid(),plan:z.enum(["plus","pro","studio"]),status:z.enum(["ready","revoked","held","redeemed","expired"]),
  })).safeParse(giftsResponse.data);
  const locale=accountLocale(user.user_metadata?.snoozer_locale);
  const t=(key:string)=>accountLabel(locale,key);

  return <main className="shell studio-shell studio-account-page studio-account-reference">
    {status.email==="confirmation"&&<p role="status">Check your current and new email inboxes to complete the email change. Your current address remains active until confirmation.</p>}
    {status.email==="changed"&&<p role="status">Your email address has been updated.</p>}
    {status.google==="linked"&&<p role="status">Google is now linked to this Snoozer account.</p>}
    {status.google==="failed"&&<p role="alert">Google linking could not be completed. The existing account was not changed.</p>}
    {status.google==="unavailable"&&<p role="alert">Google linking is temporarily unavailable.</p>}
    {status.session==="revoked"&&<p role="status">The selected device session has been signed out.</p>}
    {status.session==="failed"&&<p role="alert">That session could not be revoked. Refresh the list and try again.</p>}
    {status.mfa==="disabled"&&<p role="status">Authenticator MFA has been removed.</p>}
    {status.mfa==="recovered"&&<p role="status">Your recovery code restored password-verified access. Set up and verify a new authenticator before performing AAL2-protected actions.</p>}
    {status.mfa==="failed"&&<p role="alert">MFA could not be removed.</p>}
    {status.identity==="unlinked"&&<p role="status">The selected sign-in identity has been unlinked.</p>}
    {status.identity==="last"&&<p role="alert">Keep at least one other sign-in identity connected before unlinking this one.</p>}
    {status.identity==="presencefailed"&&<p role="alert">Discord presence could not be disconnected, so the Discord identity was left linked.</p>}
    {status.identity&& !["unlinked","last","presencefailed"].includes(status.identity)&&<p role="alert">The sign-in identity could not be unlinked. It may already be disconnected or require account-provider configuration.</p>}
    {status.marketing==="saved"&&<p role="status">Your email marketing preference has been saved.</p>}
    {status.marketing&&status.marketing!=="saved"&&<p role="alert">Your email marketing preference could not be updated.</p>}
    {status.language==="saved"&&<p role="status">Your language preference has been saved.</p>}
    {status.language&&status.language!=="saved"&&<p role="alert">Your language preference could not be updated.</p>}

    <header className="studio-page-heading">
      <div><p className="eyebrow">ACCOUNT / SETTINGS</p><h1>{t("Account Settings")}</h1></div>
    </header>

    <section id="account-general-information" className="studio-dashboard-panel studio-account-settings-section">
      <div className="studio-panel-heading"><h2>{t("General Information")}</h2></div>
      {draft&&<div className="studio-setting-row"><div><strong>{t("Username")}</strong><p>@{draft.username}</p></div><ProfileUsernameChange profileId={draft.profile_id} username={draft.username}/></div>}
      {draft&&<div id="account-display-name" className="studio-setting-row"><div><strong>{t("Display Name")}</strong><p>{draft.display_name}</p></div><Link className="button small" href="/studio/customize">{t("Edit Display Name")} ↗</Link></div>}
      {draft&&aliases.success&&!aliasResponse.error&&<div id="account-aliases" className="studio-setting-row"><div><strong>{t("Alias")}</strong></div><ProfileAliases profileId={draft.profile_id} inventory={aliases.data}/></div>}
      <div id="account-email" className="studio-setting-row"><div><strong>{t("Email")}</strong><p>{user.email?maskEmail(user.email):"No email address is currently available."}</p></div><details className="studio-reveal-email"><summary>Show email</summary><p>{user.email??"No email address is currently available."}</p></details></div>
    </section>

    <section id="account-language" className="studio-dashboard-panel studio-account-settings-section">
      <div className="studio-panel-heading"><h2>{t("Language Settings")}</h2></div>
      <p className="muted">{t("Choose language")}</p>
      <AccountLanguageSelect locale={locale} label={t("Language")} options={accountLocales}/>
    </section>

    <section id="account-security" className="studio-dashboard-panel studio-account-settings-section">
      <div className="studio-panel-heading"><h2>{t("Security Settings")}</h2></div>
      <div id="account-mfa" className="studio-setting-row studio-setting-row--stack">
        <div><strong>{t("Multi-factor authentication")}</strong><p>Protect account sign-ins with an authenticator app.</p></div>
        <div className="studio-account-security-control">
          <AccountSecurityMfa verifiedFactorIds={verifiedTotp.map((factor)=>factor.id)}/>
          {verifiedTotp.map((factor)=><form key={factor.id} action={disableAccountMfa}><input type="hidden" name="factorId" value={factor.id}/><button className="button small studio-danger-button" type="submit">Disable MFA</button></form>)}
        </div>
      </div>
      <details id="account-sessions" className="studio-setting-row studio-setting-row--stack studio-session-management">
        <summary><div><strong>Session Management</strong><p>Review devices currently signed into your account and revoke sessions you do not recognise.</p></div><span aria-hidden="true">⌄</span></summary>
        <div className="studio-device-sessions">
          {sessions.success?sessions.data.length?sessions.data.map((session)=><article className="studio-device-session" key={session.session_id}>
            <div><strong>{deviceLabel(session.user_agent)}</strong><p className="muted">{session.is_current?"Current device":"Other device"} · Last active {new Date(session.last_active_at??session.created_at).toLocaleString("en-GB")}</p></div>
            {session.is_current?<span className="studio-setting-status is-good">This device</span>:<form action={revokeDeviceSession}><input type="hidden" name="session" value={session.session_id}/><button className="button small studio-danger-button" type="submit">Revoke session</button></form>}
          </article>):<p>No active sessions were found.</p>:<p role="alert">Active sessions are temporarily unavailable.</p>}
        </div>
      </details>
    </section>

    <section id="account-connections" className="studio-dashboard-panel studio-account-settings-section">
      <div className="studio-panel-heading"><h2>{t("Connections")}</h2></div>
      <div id="account-google" className="studio-setting-row">
        <div><strong>{t("Login with Google")}</strong><p>Sign in to Snoozer with your Google account.</p></div>
        {googleSignIn&&identities.length>1?<form action={unlinkSignInIdentity} className="stack"><input type="hidden" name="provider" value="google"/><label className="check"><input type="checkbox" name="confirm_unlink" required/> Confirm unlink</label><button className="button small studio-danger-button" type="submit">Unlink Google</button></form>:googleSignIn?<span className="studio-setting-status is-good">Connected · primary sign-in</span>:<form action={linkGoogleIdentity}><button className="button small" type="submit">Connect Google</button></form>}
      </div>
      <div id="account-discord" className="studio-setting-row">
        <div><strong>{t("Login with Discord")}</strong><p>Sign in to Snoozer with your Discord account.</p></div>
        {discordSignIn&&identities.length>1?<form action={unlinkSignInIdentity} className="stack"><input type="hidden" name="provider" value="discord"/><label className="check"><input type="checkbox" name="confirm_unlink" required/> Confirm unlink</label><button className="button small studio-danger-button" type="submit">Unlink Discord</button></form>:<span className={"studio-setting-status"+(discordSignIn?" is-good":"")}>{discordSignIn?"Connected · primary sign-in":"Not connected"}</span>}
      </div>
    </section>

    <section id="account-gifts" className="studio-dashboard-panel studio-account-settings-section">
      <div className="studio-panel-heading"><h2>{t("Gift Links")}</h2><Link className="button small" href="/studio/plan/gifts">{t("Buy a gift")} ↗</Link></div>
      <p className="muted">{t("View and manage all of your purchased gifts.")}</p>
      {gifts.success&&gifts.data.length?gifts.data.map((gift)=><div className="studio-setting-row" key={gift.order_id}><div><strong>{gift.plan.toUpperCase()}</strong><p>{gift.status}</p></div><Link className="button small" href="/studio/plan/gifts">{t("Manage gift")} ↗</Link></div>):<div className="studio-gift-empty"><strong>{t("No gift links yet")}</strong><p>{t("You don’t have any gift links yet.")}</p></div>}
      {giftsResponse.error&&<p role="alert">Gift purchase history is unavailable.</p>}
    </section>

    <section id="account-email-marketing" className="studio-dashboard-panel studio-account-settings-section">
      <div className="studio-panel-heading"><h2>{t("Email Marketing")}</h2></div>
      {marketing.success?<form action={updateMarketingPreference} className="studio-marketing-preference">
        <div><strong>{t("Email updates")}</strong><p className="muted">Receive product news and offers by email. Important account, security and billing messages remain enabled.</p></div>
        <button type="submit" role="switch" aria-checked={marketing.data.emailOptIn}
          aria-label={marketing.data.emailOptIn?"Turn email marketing off":"Turn email marketing on"}
          name="email_opt_in" value={String(!marketing.data.emailOptIn)}
          className={"studio-reference-switch"+(marketing.data.emailOptIn?" is-on":"")}>
          <span/>
        </button>
      </form>:<p role="alert">Email marketing preferences are temporarily unavailable.</p>}
    </section>

    <section className="studio-dashboard-panel studio-account-settings-section">
      <div className="studio-panel-heading"><h2>{t("Account Actions")}</h2></div>
      <div className="studio-account-action-item"><strong>{t("Regenerate Recovery Codes")}</strong><AccountRecoveryCodes enabled={verifiedTotp.length>0}/></div>
      <details id="account-email-change" className="studio-account-action-item studio-account-action-disclosure">
        <summary>{t("Change Email")} <span aria-hidden="true">↗</span></summary>
        <EmailChangeForm/>
      </details>
      <div className="studio-account-action-item"><strong>{t("Change Password")}</strong><p className="muted">Changing your password will sign you out of every device.</p><Link className="button small" href="/forgot-password">{t("Change Password")} ↗</Link></div>
      <form className="studio-account-action-item studio-account-logout" action={signOut}><button className="button studio-danger-button" type="submit">{t("Logout")}</button></form>
      <div className="studio-account-action-item"><Link className="button studio-danger-button" href="/account/data">{t("Delete Account")} ↗</Link><p className="muted">Account deletion starts with a reviewed request. Submitting a request does not immediately remove the account.</p></div>
    </section>
  </main>;
}
