import Link from "next/link";
import { CopyLink } from "@/components/copy-link";
import { ProfileCard } from "@/components/profile-card";
import { defaultProfileWidgets } from "@/lib/profile-widgets";
import { EmptyState } from "@/components/ui";
import { defaultAppearance, profileAppearance, profileLayouts, themes, textSections } from "@/lib/profile";
import { findTemplates, getTemplatePage, templateCategories, templateFilters, templatePalettes, templatePaletteThemes, templateStyleCategories, templatePageSize } from "@/lib/studio-templates";
import { readStudioDraft, requireAccount, type StudioProfileQuery } from "@/lib/profiles-server";
import { rateStudioTemplate, setTemplateFavorite, useStudioTemplate } from "./actions";
import { z } from "zod";

export const metadata = { title: "Template Library", robots: { index: false, follow: false } };
type Search = StudioProfileQuery & {
  q?: string|string[]; theme?:string|string[]; layout?:string|string[]; category?:string|string[];
  palette?:string|string[]; page?:string|string[]; tab?:string|string[]; error?:string|string[];
  sort?:string|string[]; rated?:string;
};
const templateMetricSchema=z.array(z.object({
  template_key:z.string(),uses:z.coerce.number().int().nonnegative(),weekly_uses:z.coerce.number().int().nonnegative(),
  rating_count:z.coerce.number().int().nonnegative(),rating_average:z.coerce.number().min(0).max(5),
  my_rating:z.number().int().min(1).max(5).nullable(),
}));
const communityListingSchema=z.object({
  items:z.array(z.object({
    id:z.uuid(),title:z.string(),description:z.string(),created_at:z.string(),usage_count:z.coerce.number().int().nonnegative(),
    config:z.object({theme:z.enum(themes),appearance:z.record(z.string(),z.unknown()),sections:z.unknown()}),
    creator_username:z.string(),rating_count:z.coerce.number().int().nonnegative(),
    rating_average:z.coerce.number().min(0).max(5),weekly_uses:z.coerce.number().int().nonnegative()
  })).max(12),
  total:z.number().int().nonnegative(),page:z.number().int().positive(),pageCount:z.number().int().positive()
});
const layoutLabels={centred:"Centred",editorial:"Editorial",portfolio:"Portfolio"};

function ratingLabel(average:number,count:number) {
  return count>0 ? "★ "+average.toFixed(1)+" · "+count+" ratings" : "Not rated yet";
}
function templatePreviewProfile(theme:typeof themes[number],appearance:z.infer<typeof profileAppearance>,sections:z.infer<typeof textSections>) {
  return {
    seo:{title:"",description:""},username:"snoozer-preview",display_name:"Your name",
    bio:"A little space on the internet that feels like you.",theme,indexable:false,avatar:null,
    appearance,blocks:[],pageLayout:{version:1 as const,items:[]},gallery:[],badges:[],
    widgets:defaultProfileWidgets,links:[{label:"Your website",url:"https://example.com/"}],sections
  };
}

export default async function StudioTemplates({ searchParams }: { searchParams: Promise<Search> }) {
  const params=await searchParams;
  const draft=await readStudioDraft(params.profile);
  const selected=params.profile===undefined?undefined:draft?.profile_id;
  const {client}=await requireAccount();
  const activityResponse=await client.rpc("get_my_template_activity");
  const activity=z.object({favorites:z.array(z.string()),recent:z.array(z.string())}).safeParse(activityResponse.data);
  const favorites=activity.success?activity.data.favorites:[];
  const recent=activity.success?activity.data.recent:[];
  const tabs=["library","favorites","recent"] as const;
  const requestedTab=typeof params.tab==="string"?params.tab:"library";
  const tab=(tabs as readonly string[]).includes(requestedTab)?requestedTab:"library";
  const filters=templateFilters(params);
  const allTemplates=findTemplates(filters);
  const templates=tab==="favorites"?allTemplates.filter(item=>favorites.includes(item.id))
    :tab==="recent"?recent.flatMap(id=>allTemplates.filter(item=>item.id===id)):allTemplates;
  const {page,pageCount,start}=getTemplatePage(params.page,templates.length);
  const visible=templates.slice(start,start+templatePageSize);
  const active=Boolean(filters.q||filters.theme!=="all"||filters.layout!=="all"||filters.category!=="all"||filters.palette!=="all");
  const profileQuery=selected?"&profile="+encodeURIComponent(selected):"";
  const clearHref=selected?"/studio/templates?tab="+tab+"&profile="+encodeURIComponent(selected):"/studio/templates?tab="+tab;
  const queryForPage=(next:number)=>{
    const query=new URLSearchParams({tab});
    if(filters.q)query.set("q",filters.q);
    if(filters.theme!=="all")query.set("theme",filters.theme);
    if(filters.layout!=="all")query.set("layout",filters.layout);
    if(filters.category!=="all")query.set("category",filters.category);
    if(filters.palette!=="all")query.set("palette",filters.palette);
    if(selected)query.set("profile",selected);
    if(next>1)query.set("page",String(next));
    return "/studio/templates?"+query.toString();
  };

  const [communityResponse]=await Promise.all([
    client.rpc("list_community_templates",{
      p_query:filters.q,p_sort:params.sort==="newest"?"newest":"popular",p_page:1
    })
  ]);
  const communityParsed=communityListingSchema.safeParse(communityResponse.data);
  const community=communityParsed.success?communityParsed.data.items.flatMap(item=>{
    const appearance=profileAppearance.safeParse({...defaultAppearance,...item.config.appearance});
    const sections=textSections.safeParse(item.config.sections??[]);
    if(!appearance.success||!sections.success)return [];
    const style=appearance.data.templateStyle;
    if(filters.theme!=="all"&&item.config.theme!==filters.theme)return [];
    if(filters.layout!=="all"&&appearance.data.layout!==filters.layout)return [];
    if(filters.palette!=="all"&&templatePaletteIdForAppearance(appearance.data)!==filters.palette)return [];
    if(filters.category!=="all"&&(!style||templateStyleCategories[style]!==filters.category))return [];
    return [{...item,config:{theme:item.config.theme,appearance:appearance.data,sections:sections.data}}];
  }):[];
  const metricKeys=[...visible.map(item=>item.id),...community.map(item=>item.id)];
  const metricResponse=await client.rpc("get_template_catalogue_metrics",{p_keys:metricKeys});
  const metricParsed=templateMetricSchema.safeParse(metricResponse.data);
  const metrics=new Map((metricParsed.success?metricParsed.data:[]).map(item=>[item.template_key,item]));

  return <main className="shell studio-shell studio-template-page template-library">
    <header className="studio-page-heading">
      <div><p className="eyebrow">YOUR PROFILE / DESIGN LIBRARY</p><h1>Find your profile style.</h1>
        <p className="muted">Browse profile designs, save favourites, rate templates and return to your recent choices.</p>
        <div className="template-library-stats"><span><strong>120</strong> curated designs</span><span><strong>{favorites.length}</strong> favourites</span></div>
      </div>
      <Link className="button primary" href={selected?"/studio/customize?profile="+encodeURIComponent(selected):"/studio/customize"}>Customise profile ↗</Link>
    </header>
    <nav className="studio-template-tabs" aria-label="Template sections">
      {[["library","Discover"],["favorites","Favourites"],["recent","Last Used"]].map(([id,label])=>
        <Link key={id} aria-current={tab===id?"page":undefined} className={"button small"+(tab===id?" is-active":"")}
          href={"/studio/templates?tab="+id+profileQuery}>{label}</Link>)}
    </nav>
    {params.error&&<p className="message error" role="alert">We couldn’t complete that template action. Refresh and try again.</p>}
    {params.rated==="1"&&<p className="message" role="status">Your template rating has been saved.</p>}
    <form key={JSON.stringify(filters)+tab} action="/studio/templates" method="get" className="template-filters">
      <input type="hidden" name="tab" value={tab}/>{selected&&<input type="hidden" name="profile" value={selected}/>}
      <label>Search designs<input name="q" type="search" maxLength={80} defaultValue={filters.q} placeholder="Try anime, portfolio, terminal..."/></label>
      <label>Category<select name="category" defaultValue={filters.category}><option value="all">All categories</option>{templateCategories.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label>Colour treatment<select name="palette" defaultValue={filters.palette}><option value="all">All treatments</option>{templatePalettes.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label>Composition<select name="layout" defaultValue={filters.layout}><option value="all">All compositions</option>{profileLayouts.map(item=><option key={item} value={item}>{layoutLabels[item]}</option>)}</select></label>
      <label>Sort<select name="sort" defaultValue={params.sort==="newest"?"newest":"popular"}><option value="popular">Popular</option><option value="newest">Newest</option></select></label>
      <button className="button" type="submit">Filter templates</button>{active&&<Link className="text-link" href={clearHref}>Clear filters</Link>}
    </form>

    <div className="template-results-heading">
      <p className="muted" role="status">Showing {templates.length?start+1:0}–{Math.min(start+templatePageSize,templates.length)} of {templates.length} matching designs</p>
      <p className="muted">Page {page} of {pageCount}</p>
    </div>
    {templates.length===0&&community.length===0&&<EmptyState
      title={tab==="favorites"?"No favourite templates yet":tab==="recent"?"No recently used templates":"No matching designs"}
      description={tab==="library"?"Try another search or remove one of your filters.":"Save or use a design to see it here."}>
      <Link className="button" href={clearHref}>Browse designs</Link>
    </EmptyState>}

    {templates.length>0&&<ul className="template-grid" aria-label="Curated templates">
      {visible.map(template=>{
        const metric=metrics.get(template.id);
        const uses=metric?.uses??0,weekly=metric?.weekly_uses??0,count=metric?.rating_count??0,average=metric?.rating_average??0;
        const previewPath="/studio/templates/preview?template="+encodeURIComponent(template.id);
        return <li className="template-item stack" key={template.id}>
          <div className="template-item-heading"><p className="eyebrow">{template.categoryLabel} · {template.palette}</p><h2>{template.name}</h2><p className="muted">{template.description}</p></div>
          <div className="template-preview-frame"><ProfileCard avatarSrc="/icon.svg" preview previewLabel={template.name+" preview"} profile={templatePreviewProfile(template.theme,template.appearance,template.sections)}/></div>
          <div className="template-card-meta"><span className="template-card-creator">By Snoozer</span><span>{uses.toLocaleString("en-GB")} uses</span>
            <span aria-label={ratingLabel(average,count)}>{ratingLabel(average,count)}</span>{weekly>=3&&<span className="template-trending">Trending</span>}</div>
          <div className="template-card-tags"><span>{template.categoryLabel}</span><span>{template.palette}</span><span>{layoutLabels[template.appearance.layout]}</span></div>
          <div className="studio-template-card-actions">
            <form action={useStudioTemplate}><input type="hidden" name="template" value={template.id}/>{selected&&<input type="hidden" name="profile" value={selected}/>}<button className="button primary" type="submit">Use Template</button></form>
            <CopyLink path={previewPath} label="⧉"/>
            <Link className="button small" href={previewPath} aria-label={"Preview "+template.name}>◉</Link>
            <form action={setTemplateFavorite}><input type="hidden" name="template" value={template.id}/><input type="hidden" name="favorite" value={favorites.includes(template.id)?"false":"true"}/>{selected&&<input type="hidden" name="profile" value={selected}/>}<button className="button small" type="submit" aria-label={favorites.includes(template.id)?"Remove favourite":"Add favourite"}>{favorites.includes(template.id)?"★":"☆"}</button></form>
          </div>
          <form action={rateStudioTemplate} className="template-rating-form">
            <input type="hidden" name="template" value={template.id}/>
            <label>Rate this template<select name="rating" defaultValue={String(metric?.my_rating??5)}>
              <option value="5">★★★★★ · 5</option><option value="4">★★★★☆ · 4</option><option value="3">★★★☆☆ · 3</option><option value="2">★★☆☆☆ · 2</option><option value="1">★☆☆☆☆ · 1</option>
            </select></label><button className="button small" type="submit">Save rating</button>
          </form>
        </li>;
      })}
    </ul>}

    {pageCount>1&&<nav className="template-pagination" aria-label="Template pages">
      <Link className={"button"+(page===1?" is-disabled":"")} aria-disabled={page===1} tabIndex={page===1?-1:undefined} href={queryForPage(Math.max(1,page-1))}>Previous</Link>
      <span className="muted">Page {page} / {pageCount}</span>
      <Link className={"button"+(page===pageCount?" is-disabled":"")} aria-disabled={page===pageCount} tabIndex={page===pageCount?-1:undefined} href={queryForPage(Math.min(pageCount,page+1))}>Next</Link>
    </nav>}

    {community.length>0&&<section className="template-community-section stack">
      <div className="template-results-heading"><div><h2>Community Templates</h2><p className="muted">Approved profile designs shared by Snoozer creators.</p></div>
        <span className="muted">{communityParsed.success?communityParsed.data.total:0} approved designs</span></div>
      <ul className="template-grid" aria-label="Community templates">
        {community.map(template=>{
          const metric=metrics.get(template.id);
          const uses=metric?.uses??template.usage_count;
          const ratingCount=metric?.rating_count??template.rating_count;
          const average=metric?.rating_average??template.rating_average;
          const previewPath="/studio/templates/preview?template="+encodeURIComponent(template.id);
          const style=template.config.appearance.templateStyle;
          return <li className="template-item stack" key={template.id}>
            <div className="template-item-heading"><p className="eyebrow">COMMUNITY · {template.config.theme}</p><h2>{template.title}</h2><p className="muted">{template.description}</p></div>
            <div className="template-preview-frame"><ProfileCard avatarSrc="/icon.svg" preview previewLabel={template.title+" preview"} profile={templatePreviewProfile(template.config.theme,template.config.appearance,template.config.sections)}/></div>
            <div className="template-card-meta"><span className="template-card-creator">By @{template.creator_username}</span><span>{uses.toLocaleString("en-GB")} uses</span>
              <span>{ratingLabel(average,ratingCount)}</span>{(metric?.weekly_uses??template.weekly_uses)>=3&&<span className="template-trending">Trending</span>}</div>
            <div className="template-card-tags"><span>Community</span><span>{style??"Custom design"}</span><span>{layoutLabels[template.config.appearance.layout]}</span></div>
            <div className="studio-template-card-actions">
              <form action={useStudioTemplate}><input type="hidden" name="template" value={template.id}/>{selected&&<input type="hidden" name="profile" value={selected}/>}<button className="button primary" type="submit">Use Template</button></form>
              <CopyLink path={previewPath} label="⧉"/>
              <Link className="button small" href={previewPath} aria-label={"Preview "+template.title}>◉</Link>
              <form action={setTemplateFavorite}><input type="hidden" name="template" value={template.id}/><input type="hidden" name="favorite" value={favorites.includes(template.id)?"false":"true"}/>{selected&&<input type="hidden" name="profile" value={selected}/>}<button className="button small" type="submit" aria-label={favorites.includes(template.id)?"Remove favourite":"Add favourite"}>{favorites.includes(template.id)?"★":"☆"}</button></form>
            </div>
            <form action={rateStudioTemplate} className="template-rating-form">
              <input type="hidden" name="template" value={template.id}/>
              <label>Rate this template<select name="rating" defaultValue="5">
                <option value="5">★★★★★ · 5</option><option value="4">★★★★☆ · 4</option><option value="3">★★★☆☆ · 3</option><option value="2">★★☆☆☆ · 2</option><option value="1">★☆☆☆☆ · 1</option>
              </select></label><button className="button small" type="submit">Save rating</button>
            </form>
          </li>;
        })}
      </ul>
    </section>}
  </main>;
}
