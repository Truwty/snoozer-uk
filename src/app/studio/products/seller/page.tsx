import Link from "next/link";
import { Brand } from "@/components/shell";
import { CreatorSellerSetup } from "@/components/creator-seller-setup";
import { creatorMerchant } from "@/lib/creator-merchant";
import { creatorSandboxConfig } from "@/lib/creator-stripe";
import { requireAccount } from "@/lib/profiles-server";

export const metadata = { title: "Sandbox seller setup", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ returned?: string; expired?: string }> }) {
  const { client } = await requireAccount();
  const result = await client.rpc("get_my_creator_sandbox_account");
  const merchant = result.data === null ? null : creatorMerchant.safeParse(result.data);
  const config = creatorSandboxConfig();
  const { returned, expired } = await searchParams;
  const unavailable = result.error || (merchant && !merchant.success);
  return <main className="shell stack"><header className="nav"><Brand /><Link className="button small" href="/studio/products">Product drafts</Link></header>
    <section className="panel stack"><p className="eyebrow">STUDIO / SELLER SETUP</p><h1>Stripe sandbox setup</h1>
      <p>Prepare an independent seller account with Stripe. This is a test environment. Your product drafts stay private and no purchase or buyer download is enabled by this setup.</p>
      <p>Creators use the full Stripe Dashboard and direct charges. The proposed model has Stripe collect processing fees and handle connected-account negative balances; live commercial, eligibility and tax settings still need approval.</p>
      {!config && <p role="status">Sandbox seller setup is waiting for operator configuration. No Stripe action is available yet.</p>}
      {returned && <p role="status">You returned from Stripe. This does not confirm completion. Check account status below.</p>}
      {expired && <p role="status">The single-use Stripe link expired or was already used. Resume setup to request a fresh link after confirming the notice.</p>}
      {unavailable ? <p role="alert">Seller setup could not be loaded. Reload to try again.</p> : <>
        <p>{merchant?.success ? merchant.data.accountId ? merchant.data.ready ? "Last check: sandbox card payments and payouts active." : "Sandbox account created; onboarding or capability review may still be required." : "Account creation is pending reconciliation of the same setup attempt." : "No sandbox seller account is linked."}</p>
        {merchant?.success && merchant.data.checkedAt && <p className="muted">Last status check: <time dateTime={merchant.data.checkedAt}>{merchant.data.checkedAt}</time>. Readiness is rechecked before any future payment operation.</p>}
        <CreatorSellerSetup enabled={!!config && (!merchant?.success || merchant.data.platformId === config.platformId)} bound={!!(merchant?.success && merchant.data.accountId)} />
        {merchant?.success && merchant.data.accountId && <a href={`https://dashboard.stripe.com/${merchant.data.accountId}`} rel="noopener noreferrer" target="_blank">Open full Stripe Dashboard</a>}
      </>}
    </section>
  </main>;
}
