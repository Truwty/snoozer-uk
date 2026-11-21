import Link from "next/link";
import { cookies } from "next/headers";
import { AccountMenu } from "./account-menu";
import { Brand } from "./shell";
import { currentSlot, storedAccounts } from "@/lib/account-session-server";
import { sessionClient } from "@/lib/supabase";
import { username as usernameShape } from "@/lib/profile";
import { maxSavedAccounts } from "@/lib/account-sessions";

export async function SiteHeader() {
  const jar = await cookies();
  const accounts = storedAccounts(jar);
  const activeSlot = currentSlot(jar);
  let current: { label: string; username?: string; avatar?: string } | null = null;
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
      current = {
        label: name ?? entry?.label ?? data.user.email?.split("@")[0] ?? "My account",
        username: name,
        avatar: name && avatarId ? `/media/avatar/${name}/${avatarId}` : undefined,
      };
    }
  } catch {
    // A temporary Auth/provider outage must not crash the public navigation.
  }

  // Legacy Supabase session cookies have no account registry yet; still offer
  // account switching and migration on the first successful explicit login.
  const visibleAccounts = accounts.length > maxSavedAccounts ? accounts.slice(0, maxSavedAccounts) : accounts;
  return <header className="snoozer-global-header">
    <div className="snoozer-topbar">
      <Brand />
      <nav className="snoozer-header-links" aria-label="Primary navigation">
        <Link href="/help">Help Center</Link>
        <Link href="/templates">Templates</Link>
        <Link href="/leaderboard">Leaderboard</Link>
        <Link href="/pricing">Pricing</Link>
      </nav>
      <AccountMenu accounts={visibleAccounts} activeSlot={activeSlot} current={current}/>
    </div>
  </header>;
}
