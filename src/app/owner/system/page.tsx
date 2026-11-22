import Link from "next/link";
export default function OwnerSystem() {
 return <main className="stack"><h1>Platform operations</h1><p className="muted">Existing health and billing diagnostics. Deployment administration and incident controls are not yet connected.</p>
 <div className="actions"><Link className="button" href="/studio/billing-diagnostics">Billing diagnostics</Link><Link className="button" href="/owner/security">Owner MFA</Link></div>
 <section className="panel"><h2>Operator checklist</h2><p>Check Render deployments, Supabase Auth logs and Stripe event processing before changing sitewide settings. Secrets are never displayed in the browser.</p></section>
 </main>;
}
