import { cookies } from "next/headers";
import { AccountMenu } from "@/components/account-menu";
import { currentSlot, storedAccounts } from "@/lib/account-session-server";
import { sessionClient } from "@/lib/supabase";
import { username as usernameShape } from "@/lib/profile";
import { maxSavedAccounts } from "@/lib/account-sessions";

export async function StudioAccountControl() {
  const jar = await cookies();
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
      const avatarId = typeof draft?.avatar === "string" && /^[0-9a-f-]{36}$/i.test(draft.avatar) ? draft.avatar : undefined;
      const ownerResult = await client.rpc("is_platform_owner");
      current = {
        isOwner: !ownerResult.error && ownerResult.data === true,
        label: name ?? entry?.label ?? data.user.email?.split("@")[0] ?? "My account",
        username: name,
        avatar: name && avatarId ? `/media/avatar/${name}/${avatarId}` : undefined,
      };
    }
  } catch {
    // Keep Studio navigation available during a temporary Auth outage.
  }
  const visibleAccounts = !current && accounts.length === 1 && accounts[0].slot === "primary" && !accounts[0].userId
    ? [] : accounts.slice(0, maxSavedAccounts);
  return <div className="studio-account-control"><AccountMenu accounts={visibleAccounts} activeSlot={activeSlot} current={current}/></div>;
}
