import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ProfileCard } from "@/components/profile-card";
import { EmptyState } from "@/components/ui";
import { defaultAppearance, profileLayouts, themes } from "@/lib/profile";
import { findTemplates, templateFilters } from "@/lib/studio-templates";

export const metadata = {
  title: "Templates",
  description: "Explore first-party Snoozer templates for your personal page.",
};

export default async function Templates({ searchParams }: { searchParams: Promise<{ q?: string | string[]; theme?: string | string[]; layout?: string | string[] }> }) {
  const filters = templateFilters(await searchParams);
  const templates = findTemplates(filters);
  const active = filters.q || filters.theme !== "all" || filters.layout !== "all";
  const layoutLabels = { centred: "Centred card", editorial: "Editorial", portfolio: "Portfolio grid" };

  return <main className="shell stack">
    <SiteHeader />
    <header className="page-header stack">
      <p className="eyebrow">SNOOZER STUDIO</p>
      <h1>Find a starting point</h1>
      <p className="muted">Explore twelve free template styles. Change the colours and text in Studio before sharing your page.</p>
    </header>
    <form key={JSON.stringify(filters)} action="/templates" method="get" className="template-filters">
      <label>Search templates<input name="q" type="search" maxLength={80} defaultValue={filters.q} placeholder="Name or style" /></label>
      <label>Template theme<select name="theme" defaultValue={filters.theme}><option value="all">All themes</option>{themes.map((theme) => <option key={theme} value={theme}>{theme[0].toUpperCase() + theme.slice(1)}</option>)}</select></label>
      <label>Template layout<select name="layout" defaultValue={filters.layout}><option value="all">All layouts</option>{profileLayouts.map((layout) => <option key={layout} value={layout}>{layoutLabels[layout]}</option>)}</select></label>
      <button className="button" type="submit">Find templates</button>
      {active && <Link className="text-link" href="/templates">Clear filters</Link>}
    </form>
    <p className="muted" role="status">{templates.length} {templates.length === 1 ? "template" : "templates"} found</p>
    {templates.length === 0 && <EmptyState title="No matching templates" description="Try a different name, theme or layout."><Link className="button" href="/templates">Browse all templates</Link></EmptyState>}
    <ul className="template-grid">
      {templates.map((template) => <li className="template-item stack" key={template.id}>
        <p className="eyebrow">EXAMPLE · {template.id}</p>
        <ProfileCard avatarSrc="/icon.svg" preview previewLabel={template.name + " preview"} profile={{ seo: { title: "", description: "" },
          username: template.id, display_name: template.name, bio: template.description, theme: template.theme,
          indexable: false, avatar: null, appearance: template.appearance ?? defaultAppearance, gallery: [], links: [{ label: "GitHub", url: "https://github.com/" }], sections: template.sections,
        }} />
        <Link className="button primary" href={`/studio?template=${template.id}`}>Use this template</Link>
      </li>)}
    </ul>
  </main>;
}
