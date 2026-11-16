import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/shell";
import { supabaseKey, supabaseUrl } from "@/lib/env";
import { accountPlan, can } from "@/lib/entitlements";
import { requireAccount } from "@/lib/profiles-server";
import { storageAdmin } from "@/lib/supabase";
import { startSandboxCheckout } from "./checkout";

export const metadata = { title: "Plan and usage", robots: { index: false, follow: false } };

const labels = { free: "Free", plus: "Plus", pro: "Pro", studio: "Studio" };

async function sandboxOffers() {
  if (!/^(rk|sk)_test_/.test(process.env.STRIPE_SANDBOX_API_KEY ?? "")
      || !process.env.STRIPE_SANDBOX_WEBHOOK_SECRET?.startsWith("whsec_")
      || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const admin = storageAdmin();
  return (await Promise.all(Object.entries(labels).filter(([plan]) => plan !== "free").flatMap(([plan, label]) =>
    (["month", "year"] as const).map(async (interval) => {
      const { data, error } = await admin.rpc("resolve_stripe_sandbox_price", { p_plan: plan, p_interval: interval }).maybeSingle();
      if (error || !data || typeof data !== "object" || !("unit_amount" in data)
          || typeof data.unit_amount !== "number") return null;
      return { plan, label, interval, amount: new Intl.NumberFormat("en-GB", {
        style: "currency", currency: "GBP",
      }).format(data.unit_amount / 100) };
    }),
  ))).filter((item) => item !== null);
}

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  if (!supabaseUrl || !supabaseKey) redirect("/sign-in");
  const { client, user } = await requireAccount();
  const { data, error } = await client.rpc("get_my_plan");
  const result = accountPlan.safeParse(data);
  const plan = error || !result.success ? null : result.data;
  const hasLinkCapacity = plan && can({ id: user.id, plan },
    { quota: "links", used: plan.usage.draftLinks, increment: 1 }, { ownerId: user.id });

  const [offers, { checkout }] = await Promise.all([sandboxOffers(), searchParams]);

  return <main className="shell">
    <header className="nav"><Brand /><Link className="button small" href="/studio">Back to Studio</Link></header>
    <section className="panel stack">
      <h1>Plan and usage</h1>
      {plan ? <>
        <p>Current plan: <strong>{labels[plan.plan]}</strong></p>
        {plan.expiresAt && <p>Plan access ends on <time dateTime={plan.expiresAt}>
          {new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(new Date(plan.expiresAt))}
        </time>.</p>}
        <dl className="stack">
          <div><dt>Published profiles</dt><dd>{plan.usage.publishedProfiles} of {plan.quotas.profiles}</dd></div>
          <div><dt>Draft links</dt><dd>{plan.usage.draftLinks} of {plan.quotas.links}</dd></div>
        </dl>
        {!hasLinkCapacity && <p>Your draft has reached its plan’s link allowance.</p>}
      </> : <p role="alert">Plan and usage are temporarily unavailable.</p>}
      {checkout === "pending" && <p role="status">Returned from sandbox checkout. Payment confirmation is pending.</p>}
      {checkout === "unavailable" && <p role="alert">Could not open sandbox checkout. Try your original offer again or contact support.</p>}
      {offers.length > 0 && <div className="stack">
        <h2>Stripe sandbox offers</h2>
        {offers.map(({ plan, label, interval, amount }) => <form key={plan + interval} action={startSandboxCheckout}>
          <input type="hidden" name="plan" value={plan} />
          <input type="hidden" name="interval" value={interval} />
          <button className="button small" type="submit">{label} · {amount} per {interval} · Test checkout</button>
        </form>)}
      </div>}
    </section>
  </main>;
}
