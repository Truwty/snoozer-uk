import Link from "next/link";
import { Brand } from "@/components/shell";
import { ProfileCard } from "@/components/profile-card";
import { studioTemplates } from "@/lib/studio-templates";

export const metadata = {
  title: "Templates",
  description: "Explore first-party Snoozer templates for your personal page.",
};

export default function Templates() {
  return <main className="shell stack">
    <header className="nav"><Brand /><Link className="button small" href="/sign-up">Create your page</Link></header>
    <header className="panel stack">
      <p className="eyebrow">SNOOZER STUDIO</p>
      <h1>Find a starting point</h1>
      <p className="muted">Explore three free templates. Change the colours and text in Studio before sharing your page.</p>
    </header>
    <ul className="template-grid">
      {studioTemplates.map((template) => <li className="panel stack" key={template.id}>
        <p>{template.description}</p>
        <ProfileCard preview previewLabel={template.name + " preview"} profile={{
          username: "template-preview", display_name: template.name, bio: "", theme: template.theme,
          indexable: false, avatar: null, gallery: [], links: [], sections: template.sections,
        }} />
        <Link className="button" href={`/studio?template=${template.id}`}>Open {template.name} in Studio</Link>
      </li>)}
    </ul>
  </main>;
}
