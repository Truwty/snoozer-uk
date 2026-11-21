import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Brand } from "@/components/shell";
import { activeAccount, rememberedAccounts } from "@/lib/account-switching";
import { sessionClient } from "@/lib/supabase";
import { supabaseKey, supabaseUrl } from "@/lib/env";
import { addAnotherAccount, removeRememberedAccount, switchToAccount } from "@/app/auth/account-actions";
import { signOut } from "@/app/auth/actions";
import type { AccountSlot, RememberedAccount } from "@/lib/account-slots";

function avatarLetters(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : label.slice(0, 2)).toUpperCase();
}

function AccountSwitcher({ user, accounts, active }: {
  user: User | null;
  accounts: RememberedAccount[];
  active: AccountSlot;
}) {
  const activeSaved = accounts.find((account) => account.slot === active && account.id === user?.id);
  const currentLabel = activeSaved?.label ?? (typeof user?.user_metadata?.full_name === "string"
    ? user.user_metadata.full_name : user?.email?.split("@")[0] ?? "Account");
  const current = user ? { slot: active, id: user.id, email: user.email ?? "", label: currentLabel } : null;
  const shown = current && !activeSaved ? [current, ...accounts.filter((account) => account.slot !== active)] : accounts;

  return <details className="account-switcher">
    <summary aria-label="Account menu" className="account-trigger">
      <span className="account-avatar" aria-hidden="true">{avatarLetters(current?.label ?? "Accounts")}</span>
      <span className="account-trigger-name">{current?.label ?? "Accounts"}</span>
      <span className="account-chevron" aria-hidden="true">⌄</span>
    </summary>
    <div className="account-popover">
      <p className="account-popover-title">Your accounts</p>
      <p className="account-popover-caption">Switch without signing in again on this device.</p>
      <div className="account-list">
        {shown.map((account) => {
          const selected = current?.id === account.id && current.slot === account.slot;
          return <div className="account-entry" key={account.slot}>
            <form action={switchToAccount} className="account-entry-form">
              <input type="hidden" name="slot" value={account.slot} />
              <button type="submit" disabled={selected} className="account-entry-button" aria-current={selected ? "true" : undefined}>
                <span className="account-avatar" aria-hidden="true">{avatarLetters(account.label)}</span>
                <span className="account-entry-text"><strong>{account.label}</strong><small>{account.email}</small></span>
                {selected && <span className="account-selected" aria-label="Current account">✓</span>}
              </button>
            </form>
            {!selected && <form action={removeRememberedAccount}>
              <input type="hidden" name="slot" value={account.slot} />
              <button className="account-remove" type="submit" aria-label={`Remove ${account.label} from this device`} title="Remove this account">×</button>
            </form>}
          </div>;
        })}
      </div>
      <form action={addAnotherAccount}>
        <button className="account-menu-action" type="submit"><span aria-hidden="true">＋</span> Add another account</button>
      </form>
      {user && <>
        <Link className="account-menu-action" href="/studio">Open Studio</Link>
        <form action={signOut}><button className="account-menu-action account-signout" type="submit">Sign out of this account</button></form>
      </>}
    </div>
  </details>;
}

export async function SiteHeader() {
  let user: User | null = null;
  if (supabaseUrl && supabaseKey) {
    try {
      const client = await sessionClient();
      const result = await client.auth.getUser();
      user = result.data.user && !result.error && result.data.user.email_confirmed_at ? result.data.user : null;
    } catch {
      // The public navigation remains usable if the identity provider is offline.
    }
  }
  const [accounts, active] = await Promise.all([rememberedAccounts(), activeAccount()]);
  return <header className="site-header nav">
    <Brand />
    <nav aria-label="Primary navigation" className="site-nav">
      <Link href="/templates">Templates</Link>
      <Link href="/leaderboard">Leaderboard</Link>
      <Link href="/pricing">Pricing</Link>
      <Link href="/help">Help Center</Link>
    </nav>
    <div className="site-header-actions">
      {user ? <Link href="/studio" className="button small site-studio-link">Studio</Link>
        : <Link href="/sign-in" className="button small site-signin-link">Sign in</Link>}
      {(user || accounts.length > 0) && <AccountSwitcher user={user} accounts={accounts} active={active} />}
      {!user && <Link href="/sign-up" className="button small primary">Get started</Link>}
    </div>
  </header>;
}
