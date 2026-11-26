import Link from "next/link";
import "../discovery-form-controls.css";
import "./owner-discovery.css";
import { requireOwner } from "@/lib/owner/auth";

const sections = [
  ["Overview", "/owner"], ["Users", "/owner/users"], ["Profiles", "/owner/profiles"],
  ["Moderation", "/owner/moderation"], ["Templates", "/owner/community-templates"], ["Discovery", "/owner/discovery"], ["Premium", "/owner/premium"],
  ["Badges", "/owner/badges"], ["Gift links", "/owner/gifts"],
  ["Analytics", "/owner/analytics"], ["Settings", "/owner/settings"],
  ["Privacy requests", "/owner/privacy"], ["Audit log", "/owner/audit"], ["System", "/owner/system"],
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
