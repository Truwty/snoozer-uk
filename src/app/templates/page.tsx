import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ProfileCard } from "@/components/profile-card";
import { defaultProfileWidgets } from "@/lib/profile-widgets";
import { EmptyState } from "@/components/ui";
import { profileLayouts } from "@/lib/profile";
import { findTemplates, getTemplatePage, studioTemplates, templateCategories, templateFilters, templatePalettes, templatePageSize } from "@/lib/studio-templates";

export const metadata = {
  title: "Profile templates",
  description: "Explore free Snoozer profile designs across creative categories.",
};
type SearchParams = { q?: string | string[]; theme?: string | string[]; layout?: string | string[]; category?: string | string[]; palette?: string | string[]; page?: string | string[]; profile?: string | string[] };

export default async function Templates({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = templateFilters(params);
  const selectedProfile = typeof params.profile === "string" && /^[0-9a-f-]{36}$/i.test(params.profile) ? params.profile : undefined;
  const templates = findTemplates(filters);
  const { page, pageCount, start } = getTemplatePage(params.page, templates.length);
  const visibleTemplates = templates.slice(start, start + templatePageSize);
  const active = Boolean(filters.q || filters.theme !== "all" || filters.layout !== "all" || filters.category !== "all" || filters.palette !== "all");
  const compositionCount = new Set(studioTemplates.map((template) => template.style)).size;
  const categoryCount = new Set(studioTemplates.map((template) => template.category)).size;
  const paletteCount = new Set(studioTemplates.map((template) => template.paletteId)).size;
  const layoutLabels = { centred: "Centred card", editorial: "Editorial", portfolio: "Portfolio grid" };
  const queryForPage = (nextPage: number) => {
    const query = new URLSearchParams();
    if (filters.q) query.set("q", filters.q);
    if (filters.theme !== "all") query.set("theme", filters.theme);
    if (filters.layout !== "all") query.set("layout", filters.layout);
    if (filters.category !== "all") query.set("category", filters.category);
    if (filters.palette !== "all") query.set("palette", filters.palette);
    if (selectedProfile) query.set("profile", selectedProfile);
    if (nextPage > 1) query.set("page", String(nextPage));
    const queryString = query.toString();
    return "/templates" + (queryString ? "?" + queryString : "");
  };
  const templateHref = (id: string) => "/studio/builder?template=" + encodeURIComponent(id)
    + (selectedProfile ? "&profile=" + encodeURIComponent(selectedProfile) : "");

  return <main className="shell stack template-library">
    <SiteHeader />
    <header className="page-header stack">
      <p className="eyebrow">SNOOZER STUDIO · DESIGN LIBRARY</p>
      <h1>Find your profile style.</h1>
      <p className="muted">Explore {studioTemplates.length} original starting points across {compositionCount} compositions and {categoryCount} creative categories. Pick a design, then make the details yours in Studio.</p>
      <div className="template-library-stats" aria-label="Template library contents">
        <span><strong>{studioTemplates.length}</strong> designs</span><span><strong>{compositionCount}</strong> compositions</span><span><strong>{categoryCount}</strong> categories</span><span><strong>{paletteCount}</strong> colour treatments</span>
      </div>
    </header>
    <form key={JSON.stringify(filters)} action="/templates" method="get" className="template-filters">
      {selectedProfile && <input type="hidden" name="profile" value={selectedProfile} />}
      <label>Search designs<input name="q" type="search" maxLength={80} defaultValue={filters.q} placeholder="Try anime, portfolio, mono..." /></label>
      <label>Category<select name="category" defaultValue={filters.category}><option value="all">All categories</option>{templateCategories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
      <label>Colour treatment<select name="palette" defaultValue={filters.palette}><option value="all">All treatments</option>{templatePalettes.map((palette) => <option key={palette.id} value={palette.id}>{palette.label}</option>)}</select></label>
      <label>Composition<select name="layout" defaultValue={filters.layout}><option value="all">All compositions</option>{profileLayouts.map((layout) => <option key={layout} value={layout}>{layoutLabels[layout]}</option>)}</select></label>
      <button className="button" type="submit">Filter templates</button>
      {active && <Link className="text-link" href={selectedProfile ? "/templates?profile=" + encodeURIComponent(selectedProfile) : "/templates"}>Clear filters</Link>}
    </form>
    <div className="template-results-heading">
      <p className="muted" role="status">Showing {templates.length ? start + 1 : 0}–{Math.min(start + templatePageSize, templates.length)} of {templates.length} matching designs</p>
      <p className="muted">Page {page} of {pageCount}</p>
    </div>
    {templates.length === 0 && <EmptyState title="No matching designs" description="Try a different search or remove one of your filters."><Link className="button" href={selectedProfile ? "/templates?profile=" + encodeURIComponent(selectedProfile) : "/templates"}>Browse all templates</Link></EmptyState>}
    <ul className="template-grid">
      {visibleTemplates.map((template) => <li className="template-item stack" key={template.id}>
        <div className="template-item-heading"><p className="eyebrow">{template.categoryLabel} · {template.palette}</p><h2>{template.name}</h2><p className="muted">{template.description}</p></div>
        <div className="template-preview-frame">
          <ProfileCard avatarSrc="/icon.svg" preview previewLabel={template.name + " preview"} profile={{
            seo: { title: "", description: "" }, username: "snoozer-preview", display_name: "Your name",
            bio: "A little space on the internet that feels like you.", theme: template.theme, indexable: false,
            avatar: null, appearance: template.appearance, blocks: [], pageLayout: { version: 1, items: [] },
            gallery: [], badges: [], widgets: defaultProfileWidgets,
            links: [{ label: "Your website", url: "https://example.com/" }], sections: template.sections,
          }} />
        </div>
        <Link className="button primary" href={templateHref(template.id)}>Customise this design <span aria-hidden="true">↗</span></Link>
      </li>)}
    </ul>
    {pageCount > 1 && <nav className="template-pagination" aria-label="Template pages">
      <Link className={"button" + (page === 1 ? " is-disabled" : "")} aria-disabled={page === 1} tabIndex={page === 1 ? -1 : undefined} href={queryForPage(Math.max(1, page - 1))}>Previous</Link>
      <span className="muted">Page {page} / {pageCount}</span>
      <Link className={"button" + (page === pageCount ? " is-disabled" : "")} aria-disabled={page === pageCount} tabIndex={page === pageCount ? -1 : undefined} href={queryForPage(Math.min(pageCount, page + 1))}>Next</Link>
    </nav>}
  </main>;
}
