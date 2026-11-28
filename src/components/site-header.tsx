import Link from "next/link";
import { cookies } from "next/headers";
import { AccountMenu } from "./account-menu";
import { Brand } from "./shell";
import { currentSlot, storedAccounts } from "@/lib/account-session-server";
import { sessionClient } from "@/lib/supabase";
import { username as usernameShape } from "@/lib/profile";
import { maxSavedAccounts } from "@/lib/account-sessions";
import type { AccountLocale } from "@/lib/account-locale";
import { getCurrentAccountLocale } from "@/lib/locale-server";
import { homeContent } from "@/lib/home-translations";

export async function SiteHeader({ locale: suppliedLocale }: { locale?: AccountLocale } = {}) {
  const jar = await cookies();
  const locale = suppliedLocale ?? await getCurrentAccountLocale();
  const copy = homeContent(locale);
  const accounts = storedAccounts(jar);
  const activeSlot = currentSlot(jar);
  let current: { label: string; username?: string; avatar?: string; isOwner?: boolean } | null = null;
  try {
    const client = await sessionClient();
    const { data } = await client.auth.getUser();
    if (data.user?.email_confirmed_at) {
      const entry = accounts.find((item) => item.slot === activeSlot);
      const { data: draft } = await client.rpc("get_draft");
      const validName = usernameShape.safeParse(draft?.username);
      const name = validName.success ? validName.data : undefined;
      const avatarId = typeof draft?.avatar === "string" && /^[0-9a-f-]{36}$/i.test(draft.avatar)
        ? draft.avatar : undefined;
      const ownerResult = await client.rpc("is_platform_owner");
      current = {
        isOwner: !ownerResult.error && ownerResult.data === true,
        label: name ?? entry?.label ?? data.user.email?.split("@")[0] ?? "My account",
        username: name,
        avatar: name && avatarId ? `/media/avatar/${name}/${avatarId}` : undefined,
      };
    }
  } catch {
    // A temporary Auth/provider outage must not crash the public navigation.
  }

  const visibleAccounts = !current && accounts.length === 1
    && accounts[0].slot === "primary" && !accounts[0].userId
      ? [] : accounts.slice(0, maxSavedAccounts);

  return <header className="snoozer-global-header">
    <div className="snoozer-topbar">
      <Brand />
      <nav className="snoozer-header-links" aria-label="Primary navigation">
        <a href="https://help.snoozer.uk/">{copy.nav.help}</a>
        <Link href="/templates">{copy.nav.templates}</Link>
        <Link href="/discover">{copy.nav.discover}</Link>
        <Link href="/leaderboard">{copy.nav.leaderboard}</Link>
        <Link href="/pricing">{copy.nav.pricing}</Link>
        <a
          className="discord-server-button"
          href="https://discord.gg/PVk9UskfjD"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Join the Snoozer Discord server"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
            <path d="M7.5 6.1a16.9 16.9 0 0 1 9 0l.7 1.2c.9.3 1.8.7 2.6 1.2l1.1 7.2a2 2 0 0 1-1.1 2.1l-2.2 1.1-1.1-1.7c.7-.2 1.3-.6 1.8-1a13.8 13.8 0 0 1-12.6 0c.5.4 1.1.8 1.8 1l-1.1 1.7-2.2-1.1a2 2 0 0 1-1.1-2.1l1.1-7.2c.8-.5 1.7-.9 2.6-1.2l.7-1.2Zm2.1 5.1a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Zm4.8 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z"/>
          </svg>
          <span>Join Discord</span>
        </a>
      </nav>
      <AccountMenu accounts={visibleAccounts} activeSlot={activeSlot} current={current}/>
    </div>
  </header>;
}
