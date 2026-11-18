import Link from "next/link";
import { Brand } from "@/components/shell";
import { ProfileCard } from "@/components/profile-card";
import { defaultAppearance } from "@/lib/profile";
import { studioTemplates } from "@/lib/studio-templates";

export const metadata = {
  title: "Templates",
  description: "Explore first-party Snoozer templates for your personal page.",
};

export default function Templates() {
  return <main className="shell stack">
    <header className="nav"><Brand /><nav className="actions"><Link className="button small" href="/sign-in">Sign in</Link><Link className="button small" href="/sign-up">Create your page</Link></nav></header>
    <header className="page-header stack">
      <p className="eyebrow">SNOOZER STUDIO</p>
      <h1>Find a starting point</h1>
      <p className="muted">Explore twelve free template styles. Change the colours and text in Studio before sharing your page.</p>
    </header>
    <ul className="template-grid">
      {studioTemplates.map((template) => <li className="template-item stack" key={template.id}>
        <p className="eyebrow">EXAMPLE · {template.id}</p>
        <ProfileCard avatarSrc="/icon.svg" preview previewLabel={template.name + " preview"} profile={{
          username: template.id, display_name: template.name, bio: template.description, theme: template.theme,
          indexable: false, avatar: null, appearance: template.appearance ?? defaultAppearance, gallery: [], links: [{ label: "GitHub", url: "https://github.com/" }], sections: template.sections,
        }} />
        <Link className="button primary" href={`/studio?template=${template.id}`}>Use this template</Link>
      </li>)}
    </ul>
  </main>;
}
