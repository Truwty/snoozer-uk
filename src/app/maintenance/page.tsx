import Link from "next/link";
export const metadata = {title: "Temporarily unavailable", robots: {index:false,follow:false}};
export const dynamic = "force-dynamic";

export default function MaintenancePage() {
 return <main className="shell stack" style={{paddingTop:"5rem",maxWidth:"44rem"}}>
  <p className="eyebrow">SNOOZER / MAINTENANCE</p>
  <h1>We're carrying out maintenance.</h1>
  <p className="muted">Snoozer is temporarily unavailable while the platform is being updated. Please return later. Your account and Premium subscription remain intact.</p>
  <div className="actions"><Link className="button small" href="/sign-in">Account sign-in</Link><Link className="button small" href="/appeal">Appeals</Link></div>
 </main>;
}
