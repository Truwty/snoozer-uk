import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfileCard } from "@/components/profile-card";
import { CopyLink } from "@/components/copy-link";
import { defaultProfileWidgets } from "@/lib/profile-widgets";
import { profileAppearance, themes, textSections } from "@/lib/profile";
import { studioTemplates } from "@/lib/studio-templates";
import { requireAccount } from "@/lib/profiles-server";
import { z } from "zod";

export const metadata={title:"Template preview",robots:{index:false,follow:false}};
const idSchema=z.string().min(1).max(120);

export default async function TemplatePreview({searchParams}:{searchParams:Promise<{template?:string}>}){
 const params=await searchParams;
 const id=idSchema.safeParse(params.template);
 if(!id.success)notFound();
 const builtin=studioTemplates.find(item=>item.id===id.data);
 let preview:{id:string;name:string;description:string;theme:typeof themes[number];appearance:z.infer<typeof profileAppearance>;sections:z.infer<typeof textSections>}|null=null;
 if(builtin){
  preview={id:builtin.id,name:builtin.name,description:builtin.description,theme:builtin.theme,appearance:builtin.appearance,sections:builtin.sections};
 }else{
  const validId=z.uuid().safeParse(id.data);
  if(!validId.success)notFound();
  const {client}=await requireAccount();
  const {data,error}=await client.rpc("get_community_template",{p_id:validId.data});
  const parsed=z.object({id:z.uuid(),title:z.string(),description:z.string(),config:z.object({
    theme:z.enum(themes),appearance:profileAppearance,sections:textSections
  })}).safeParse(data);
  if(error||!parsed.success)notFound();
  preview={id:parsed.data.id,name:parsed.data.title,description:parsed.data.description,
    theme:parsed.data.config.theme,appearance:parsed.data.config.appearance,sections:parsed.data.config.sections};
 }
 if(!preview)notFound();
 const profile={seo:{title:"",description:""},username:"template-preview",display_name:"Your name",
  bio:"A preview of this Snoozer profile design.",theme:preview.theme,indexable:false,avatar:null,
  appearance:preview.appearance,blocks:[],pageLayout:{version:1 as const,items:[]},gallery:[],badges:[],
  widgets:defaultProfileWidgets,links:[{label:"Your website",url:"https://example.com/"}],sections:preview.sections};
 const sharePath="/studio/templates/preview?template="+encodeURIComponent(preview.id);
 return <main className="shell studio-shell studio-template-preview-page stack">
  <header className="studio-page-heading"><div><p className="eyebrow">TEMPLATE LIBRARY / PREVIEW</p>
   <h1>{preview.name}</h1><p className="muted">{preview.description}</p></div>
   <div className="actions"><CopyLink path={sharePath} label="Copy template link"/><Link className="button small" href="/studio/templates">Back to templates</Link></div>
  </header>
  <div className="studio-template-preview-canvas"><ProfileCard profile={profile} preview previewLabel={preview.name+" preview"} avatarSrc="/icon.svg"/></div>
 </main>;
}
