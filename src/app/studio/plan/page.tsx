import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/shell";
import { supabaseKey, supabaseUrl } from "@/lib/env";
import { accountPlan, can } from "@/lib/entitlements";
import { requireAccount } from "@/lib/profiles-server";

export const metadata = { title: "Plan and usage", robots: { index: false, follow: false } };

const labels = { free: "Free", plus: "Plus", pro: "Pro", studio: "Studio" };

export default async function PlanPage() {
  if (!supabaseUrl || !supabaseKey) redirect("/sign-in");
  const { client, user } = await requireAccount();
  const { data, error } = await client.rpc("get_my_plan");
  const result = accountPlan.safeParse(data);
  const plan = error || !result.success ? null : result.data;
  const hasLinkCapacity = plan && can({ id: user.id, plan },
    { quota: "links", used: plan.usage.draftLinks, increment: 1 }, { ownerId: user.id });

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
    </section>
  </main>;
}
