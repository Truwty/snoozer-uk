import Link from "next/link";
import { requireOwner } from "@/lib/owner/auth";

const sections = [
  ["Overview", "/owner"], ["Users", "/owner/users"], ["Profiles", "/owner/profiles"],
  ["Moderation", "/owner/moderation"], ["Premium", "/owner/premium"],
  ["Analytics", "/owner/analytics"], ["Settings", "/owner/settings"],
  ["Audit log", "/owner/audit"], ["System", "/owner/system"],
  ["Owner MFA", "/owner/security"],
] as const;
export const dynamic = "force-dynamic";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return <div className="shell stack" style={{ paddingTop: "1.5rem" }}>
    <nav aria-label="Owner administration" className="owner-nav">
      {sections.map(([label, href]) => <Link key={href} href={href} className="button small">{label}</Link>)}
    </nav>
    {children}
  </div>;
}
