import Link from "next/link";
export default function PremiumAdmin() {
 return <main className="stack"><h1>Premium administration</h1>
 <p className="muted">Manual grants and revocations are available from individual user records. Paid Stripe subscriptions remain managed by the existing verified billing provider flow.</p>
 <div className="actions"><Link className="button" href="/owner/users">Find recipient</Link><Link className="button" href="/owner/gifts">Create gift link</Link><Link className="button" href="/owner/badges">Award badges</Link><Link className="button" href="/studio/billing-diagnostics">Billing diagnostics</Link></div>
 <section className="panel"><h2>Safety rules</h2><p>Only Owner-issued staff grants can be revoked through these controls. Paid subscriptions are not cancelled or rewritten.</p></section>
 </main>;
}
