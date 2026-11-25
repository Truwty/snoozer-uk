import Link from "next/link";
import { ProfileCard } from "@/components/profile-card";
import { defaultProfileWidgets } from "@/lib/profile-widgets";
import { EmptyState } from "@/components/ui";
import { defaultAppearance, profileLayouts, themes } from "@/lib/profile";
import { findTemplates, templateFilters } from "@/lib/studio-templates";
import { readStudioDraft, type StudioProfileQuery } from "@/lib/profiles-server";

export const metadata = { title: "Template Library", robots: { index: false, follow: false } };

type Search = StudioProfileQuery & { q?: string | string[]; theme?: string | string[]; layout?: string | string[] };

export default async function StudioTemplates({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const draft = await readStudioDraft(params.profile);
  const filters = templateFilters(params);
  const selected = params.profile === undefined ? undefined : draft?.profile_id;
  const profileQuery = selected ? "&profile=" + encodeURIComponent(selected) : "";
  const templateHref = (id: string) => "/studio/builder?template=" + encodeURIComponent(id) + profileQuery;
  const templates = findTemplates(filters);
  const active = filters.q || filters.theme !== "all" || filters.layout !== "all";
  const layoutLabels = { centred: "Centred card", editorial: "Editorial", portfolio: "Portfolio grid" };

  return <main className="shell studio-shell studio-template-page">
    <header className="studio-page-heading">
      <div><p className="eyebrow">YOUR PROFILE / TEMPLATES</p><h1>Template Library</h1>
        <p className="muted">Choose a starting point, then customise the colours, layout and content in Studio. All listed templates are free to use.</p></div>
      <Link className="button primary" href="/studio/builder">Open Page Builder ↗</Link>
    </header>
    <nav className="studio-template-tabs" aria-label="Template categories">
      <Link className={filters.layout === "all" ? "is-active" : ""} href={selected ? "/studio/templates?profile=" + encodeURIComponent(selected) : "/studio/templates"}>Template Library</Link>
      <Link className={filters.layout === "centred" ? "is-active" : ""} href={selected ? "/studio/templates?layout=centred&profile=" + encodeURIComponent(selected) : "/studio/templates?layout=centred"}>Centred layouts</Link>
      <Link className={filters.layout === "editorial" ? "is-active" : ""} href={selected ? "/studio/templates?layout=editorial&profile=" + encodeURIComponent(selected) : "/studio/templates?layout=editorial"}>Editorial layouts</Link>
      <Link className={filters.layout === "portfolio" ? "is-active" : ""} href={selected ? "/studio/templates?layout=portfolio&profile=" + encodeURIComponent(selected) : "/studio/templates?layout=portfolio"}>Portfolio layouts</Link>
    </nav>

    <form key={JSON.stringify(filters)} action="/studio/templates" method="get" className="studio-template-search">
      {selected && <input type="hidden" name="profile" value={selected}/>}
      <label>Search templates<input name="q" type="search" maxLength={80} defaultValue={filters.q} placeholder="Search by name or style"/></label>
      <label>Theme<select name="theme" defaultValue={filters.theme}>
        <option value="all">All themes</option>{themes.map((theme) => <option key={theme} value={theme}>{theme[0].toUpperCase() + theme.slice(1)}</option>)}
      </select></label>
      <label>Layout<select name="layout" defaultValue={filters.layout}>
        <option value="all">All layouts</option>{profileLayouts.map((layout) => <option key={layout} value={layout}>{layoutLabels[layout]}</option>)}
      </select></label>
      <button className="button" type="submit">Find templates</button>
      {active && <Link className="text-link" href={selected ? "/studio/templates?profile=" + encodeURIComponent(selected) : "/studio/templates"}>Clear filters</Link>}
    </form>
    <p className="muted" role="status">{templates.length} {templates.length === 1 ? "template" : "templates"} available</p>
    {templates.length === 0 && <EmptyState title="No matching templates" description="Try another name, theme or layout.">
      <Link className="button" href={selected ? "/studio/templates?profile=" + encodeURIComponent(selected) : "/studio/templates"}>Browse all templates</Link>
    </EmptyState>}
    <ul className="studio-template-card-grid">
      {templates.map((template) => {
        const templateLayout = template.appearance?.layout ?? "centred";
        return <li className="studio-template-card" key={template.id}>
          <div className="studio-template-card-meta"><span>{template.theme}</span><span>{layoutLabels[templateLayout]}</span></div>
          <div className="studio-template-preview">
            <ProfileCard avatarSrc="/icon.svg" preview previewLabel={template.name + " preview"} profile={{
              seo: { title: "", description: "" }, username: template.id, display_name: template.name,
              bio: template.description, theme: template.theme, indexable: false, avatar: null,
              appearance: template.appearance ?? defaultAppearance, blocks: [],
              pageLayout: { version: 1, items: [] }, gallery: [], widgets: defaultProfileWidgets,
              links: [{ label: "GitHub", url: "https://github.com/" }], sections: template.sections,
            }}/>
          </div>
          <div className="studio-template-card-copy"><h2>{template.name}</h2><p>{template.description}</p>
            <span className="studio-template-creator">@snoozer</span></div>
          <Link className="button primary" href={templateHref(template.id)}>Use Template <span aria-hidden="true">→</span></Link>
        </li>;
      })}
    </ul>
    <p className="muted studio-template-footnote">Community uploads, saved favourites and recently used template history are not live features yet. This library only lists templates available in Snoozer today.</p>
  </main>;
}
