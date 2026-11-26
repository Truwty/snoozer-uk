import Link from "next/link";
import { ProfileCard } from "@/components/profile-card";
import { defaultProfileWidgets } from "@/lib/profile-widgets";
import { EmptyState } from "@/components/ui";
import { profileLayouts } from "@/lib/profile";
import { findTemplates, getTemplatePage, templateCategories, templateFilters, templatePalettes, templatePageSize } from "@/lib/studio-templates";
import { readStudioDraft, requireAccount, type StudioProfileQuery } from "@/lib/profiles-server";
import { reportCommunityTemplate, setTemplateFavorite, submitCommunityTemplate, useStudioTemplate } from "./actions";
import { z } from "zod";

export const metadata = { title: "Template Library", robots: { index: false, follow: false } };
type Search = StudioProfileQuery & { q?: string|string[]; theme?:string|string[]; layout?:string|string[]; category?:string|string[]; palette?:string|string[]; page?:string|string[]; tab?:string|string[]; submitted?:string|string[]; error?:string|string[]; reported?:string|string[] };

export default async function StudioTemplates({ searchParams }: { searchParams: Promise<Search> }) {
  const params=await searchParams;
  const draft=await readStudioDraft(params.profile);
  const selected=params.profile===undefined?undefined:draft?.profile_id;
  const {client}=await requireAccount();
  const {data:activityData}=await client.rpc("get_my_template_activity");
  const activity=z.object({favorites:z.array(z.string()),recent:z.array(z.string()),uploads:z.array(z.object({id:z.uuid(),title:z.string(),description:z.string(),status:z.enum(["pending","approved","rejected"]),created_at:z.string()})),community:z.array(z.object({id:z.uuid(),title:z.string(),description:z.string(),created_at:z.string()}))}).safeParse(activityData);
  const favorites=activity.success?activity.data.favorites:[];
  const recent=activity.success?activity.data.recent:[];
  const uploads=activity.success?activity.data.uploads:[];
  const community=activity.success?activity.data.community:[];
  const tabs=["library","favorites","recent","uploads","community","create"] as const;
  const requestedTab=typeof params.tab==="string"?params.tab:"library";
  const tab=(tabs as readonly string[]).includes(requestedTab)?requestedTab:"library";
  const filters=templateFilters(params);
  const allTemplates=findTemplates(filters);
  const templates=tab==="favorites"?allTemplates.filter((item)=>favorites.includes(item.id))
    :tab==="recent"?recent.flatMap((id)=>allTemplates.filter((item)=>item.id===id)):allTemplates;
  const communityActivity=community.filter((item)=>tab==="favorites"?favorites.includes(item.id):tab==="recent"?recent.includes(item.id):false);
  const {page,pageCount,start}=getTemplatePage(params.page,templates.length);
  const visible=templates.slice(start,start+templatePageSize);
  const active=Boolean(filters.q||filters.theme!=="all"||filters.layout!=="all"||filters.category!=="all"||filters.palette!=="all");
  const layoutLabels={centred:"Centred card",editorial:"Editorial",portfolio:"Portfolio grid"};
  const profileQuery=selected?"&profile="+encodeURIComponent(selected):"";
  const clearHref=selected?"/studio/templates?tab="+tab+"&profile="+encodeURIComponent(selected):"/studio/templates?tab="+tab;
  const queryForPage=(next:number)=>{
    const query=new URLSearchParams({tab}); if(filters.q)query.set("q",filters.q);
    if(filters.theme!=="all")query.set("theme",filters.theme); if(filters.layout!=="all")query.set("layout",filters.layout);
    if(filters.category!=="all")query.set("category",filters.category); if(filters.palette!=="all")query.set("palette",filters.palette);
    if(selected)query.set("profile",selected); if(next>1)query.set("page",String(next)); return "/studio/templates?"+query.toString();
  };
  return <main className="shell studio-shell studio-template-page template-library">
    <header className="studio-page-heading"><div><p className="eyebrow">YOUR PROFILE / DESIGN LIBRARY</p><h1>Find your profile style.</h1>
      <p className="muted">Browse Snoozer’s original designs, manage favourites and recent use, or submit a safe community template.</p>
      <div className="template-library-stats"><span><strong>120</strong> curated designs</span><span><strong>{favorites.length}</strong> favourites</span><span><strong>{community.length}</strong> approved community designs</span></div></div>
      <Link className="button primary" href={selected?"/studio/builder?profile="+encodeURIComponent(selected):"/studio/builder"}>Open Page Builder ↗</Link></header>
    <nav className="studio-template-tabs" aria-label="Template sections">{[["library","Template Library"],["favorites","Favourite Templates"],["recent","Last Used"],["uploads","My Uploads"],["community","Community"],["create","Create Template"]].map(([id,label])=><Link key={id} aria-current={tab===id?"page":undefined} className={"button small"+(tab===id?" is-active":"")} href={`/studio/templates?tab=${id}${profileQuery}`}>{label}</Link>)}</nav>
    {params.submitted==="1"&&<p className="message" role="status">Your template was submitted for moderation. It will appear in Community after approval.</p>}
    {params.reported==="1"&&<p className="message" role="status">Your report was submitted for review.</p>}
    {params.error&&<p className="message error" role="alert">We couldn’t complete that template action. Refresh and try again.</p>}
    {tab==="uploads"&&<section className="studio-dashboard-panel"><h2>My submissions</h2>{uploads.length?<ul>{uploads.map((item)=><li key={item.id}><strong>{item.title}</strong> · {item.status} <span className="muted">{item.description}</span></li>)}</ul>:<p className="muted">You have not submitted any community templates yet.</p>}</section>}
    {tab==="community"&&<section className="studio-dashboard-panel"><h2>Community templates</h2>{community.length?<div className="studio-community-template-grid">{community.map((item)=><article className="studio-community-template" key={item.id}>
      <p className="eyebrow">COMMUNITY · MODERATED</p><h3>{item.title}</h3><p className="muted">{item.description}</p>
      <form action={useStudioTemplate}><input type="hidden" name="template" value={item.id}/>{selected&&<input type="hidden" name="profile" value={selected}/>}<button className="button primary" type="submit">Use Template</button></form>
      <form action={setTemplateFavorite}><input type="hidden" name="template" value={item.id}/><input type="hidden" name="favorite" value={favorites.includes(item.id)?"false":"true"}/><button className="button small" type="submit">{favorites.includes(item.id)?"★ Favourite":"☆ Favourite"}</button></form>
      <details><summary>Report this template</summary><form action={reportCommunityTemplate}><input type="hidden" name="template" value={item.id}/><label>Reason<input name="reason" required minLength={8} maxLength={500}/></label><button className="button small" type="submit">Send report</button></form></details>
    </article>)}</div>:<p className="muted">No community templates have been approved yet. Submissions are checked before they appear here.</p>}</section>}
    {tab==="create"&&<section className="studio-dashboard-panel"><h2>Create a community template</h2>{!selected?<p className="muted">Choose a profile first, then save its design settings as a template.</p>:<form action={submitCommunityTemplate} className="studio-template-create-form">
      <input type="hidden" name="profile" value={selected}/><p className="muted">Only theme, appearance, and sections are shared. Your name, bio, links, avatar, gallery, widgets, embeds, and private data stay out of the template. Community templates are free and reviewed before publication.</p>
      <label>Title<input name="title" required minLength={2} maxLength={60}/></label><label>Description<input name="description" maxLength={280}/></label><button className="button primary" type="submit">Submit for review</button>
    </form>}</section>}
    {(tab==="library"||tab==="favorites"||tab==="recent")&&<>
      <form key={JSON.stringify(filters)+tab} action="/studio/templates" method="get" className="template-filters"><input type="hidden" name="tab" value={tab}/>{selected&&<input type="hidden" name="profile" value={selected}/>}
        <label>Search designs<input name="q" type="search" maxLength={80} defaultValue={filters.q} placeholder="Try anime, portfolio, terminal..."/></label>
        <label>Category<select name="category" defaultValue={filters.category}><option value="all">All categories</option>{templateCategories.map((c)=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
        <label>Colour treatment<select name="palette" defaultValue={filters.palette}><option value="all">All treatments</option>{templatePalettes.map((p)=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <label>Composition<select name="layout" defaultValue={filters.layout}><option value="all">All compositions</option>{profileLayouts.map((l)=><option key={l} value={l}>{layoutLabels[l]}</option>)}</select></label>
        <button className="button" type="submit">Filter templates</button>{active&&<Link className="text-link" href={clearHref}>Clear filters</Link>}
      </form>
      {communityActivity.length>0&&<section className="studio-dashboard-panel"><h2>Community designs</h2><div className="studio-community-template-grid">{communityActivity.map((item)=><article className="studio-community-template" key={item.id}><p className="eyebrow">COMMUNITY</p><h3>{item.title}</h3><p className="muted">{item.description}</p><form action={useStudioTemplate}><input type="hidden" name="template" value={item.id}/>{selected&&<input type="hidden" name="profile" value={selected}/>}<button className="button primary" type="submit">Use Template</button></form></article>)}</div></section>}
      <div className="template-results-heading"><p className="muted" role="status">Showing {templates.length?start+1:0}–{Math.min(start+templatePageSize,templates.length)} of {templates.length} matching designs</p><p className="muted">Page {page} of {pageCount}</p></div>
      {templates.length===0&&communityActivity.length===0&&<EmptyState title={tab==="favorites"?"No favourite templates yet":tab==="recent"?"No recently used templates":"No matching designs"} description={tab==="library"?"Try another search or remove one of your filters.":"Save or use a design to see it here."}><Link className="button" href={clearHref}>Browse designs</Link></EmptyState>}
      <ul className="template-grid">{visible.map((template)=><li className="template-item stack" key={template.id}>
        <div className="template-item-heading"><p className="eyebrow">{template.categoryLabel} · {template.palette}</p><h2>{template.name}</h2><p className="muted">{template.description}</p></div>
        <div className="template-preview-frame"><ProfileCard avatarSrc="/icon.svg" preview previewLabel={template.name+" preview"} profile={{seo:{title:"",description:""},username:"snoozer-preview",display_name:"Your name",bio:"A little space on the internet that feels like you.",theme:template.theme,indexable:false,avatar:null,appearance:template.appearance,blocks:[],pageLayout:{version:1,items:[]},gallery:[],badges:[],widgets:defaultProfileWidgets,links:[{label:"Your website",url:"https://example.com/"}],sections:template.sections}}/></div>
        <div className="studio-template-card-actions"><form action={useStudioTemplate}><input type="hidden" name="template" value={template.id}/>{selected&&<input type="hidden" name="profile" value={selected}/>}<button className="button primary" type="submit">Use Template ↗</button></form>
          <form action={setTemplateFavorite}><input type="hidden" name="template" value={template.id}/><input type="hidden" name="favorite" value={favorites.includes(template.id)?"false":"true"}/>{selected&&<input type="hidden" name="profile" value={selected}/>}<button className="button small" type="submit">{favorites.includes(template.id)?"★ Favourite":"☆ Favourite"}</button></form></div>
      </li>)}</ul>
      {pageCount>1&&<nav className="template-pagination" aria-label="Template pages"><Link className={"button"+(page===1?" is-disabled":"")} aria-disabled={page===1} tabIndex={page===1?-1:undefined} href={queryForPage(Math.max(1,page-1))}>Previous</Link><span className="muted">Page {page} / {pageCount}</span><Link className={"button"+(page===pageCount?" is-disabled":"")} aria-disabled={page===pageCount} tabIndex={page===pageCount?-1:undefined} href={queryForPage(Math.min(pageCount,page+1))}>Next</Link></nav>}
    </>}
  </main>;
}
