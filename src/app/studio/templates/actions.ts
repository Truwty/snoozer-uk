"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { readDraft, requireAccount, studioHref } from "@/lib/profiles-server";
import { profileAppearance, themes, textSections } from "@/lib/profile";
import { studioTemplates } from "@/lib/studio-templates";
import { save } from "@/app/studio/actions";

const profileId=z.uuid();
const key=z.string().regex(/^[a-zA-Z0-9-]{1,120}$/);
const uuid=z.uuid();

export async function setTemplateFavorite(form: FormData) {
  const template=key.safeParse(form.get("template")); const favorite=z.enum(["true","false"]).safeParse(form.get("favorite"));
  const profile=profileId.nullable().safeParse(form.get("profile") || null);
  if(!template.success||!favorite.success||!profile.success) redirect("/studio/templates?error=invalid");
  const {client}=await requireAccount(); const {error}=await client.rpc("set_my_template_favorite",{p_key:template.data,p_favorite:favorite.data==="true"});
  if(error) redirect("/studio/templates?error=save");
  redirect(profile.data?`/studio/templates?profile=${encodeURIComponent(profile.data)}`:"/studio/templates");
}

export async function useStudioTemplate(form: FormData) {
  const template=key.safeParse(form.get("template")); const profile=profileId.nullable().safeParse(form.get("profile")||null);
  if(!template.success||!profile.success) redirect("/studio/templates?error=invalid");
  const {client}=await requireAccount();
  const {error:historyError}=await client.rpc("record_my_template_use",{p_key:template.data});
  if(historyError) redirect("/studio/templates?error=save");
  if(studioTemplates.some((item)=>item.id===template.data)) redirect(studioHref("/studio/builder?template="+encodeURIComponent(template.data),profile.data??undefined));
  const id=uuid.safeParse(template.data); if(!id.success) redirect("/studio/templates?error=missing");
  const {data,error}=await client.rpc("get_community_template",{p_id:id.data});
  const parsed=z.object({config:z.strictObject({theme:z.enum(themes),appearance:profileAppearance,sections:textSections})}).safeParse(data);
  if(error||!parsed.success) redirect("/studio/templates?error=unavailable");
  const draft=await readDraft(profile.data??undefined);
  if(!draft) redirect("/studio");
  const result=await save({profileId:draft.profile_id,revision:draft.revision,content:{...draft,theme:parsed.data.config.theme,appearance:parsed.data.config.appearance,sections:parsed.data.config.sections},intent:"draft",removeAvatar:false});
  if(result.status!=="success") redirect("/studio/templates?error=apply");
  revalidatePath("/studio/builder"); revalidatePath("/studio");
  redirect(studioHref("/studio/builder",draft.profile_id));
}

export async function submitCommunityTemplate(form: FormData) {
  const profile=profileId.safeParse(form.get("profile"));
  const title=z.string().trim().min(2).max(60).safeParse(form.get("title"));
  const description=z.string().trim().max(280).safeParse(form.get("description")??"");
  if(!profile.success||!title.success||!description.success) redirect("/studio/templates?tab=create&error=invalid");
  const draft=await readDraft(profile.data); if(!draft) redirect("/studio");
  // Share visual settings and section structure only. Account identity, biography,
  // links, avatar, gallery, widgets, embeds, and private data are never included.
  const config={theme:draft.theme,appearance:draft.appearance,sections:draft.sections};
  const {client}=await requireAccount();
  const {error}=await client.rpc("submit_community_template",{p_profile:profile.data,p_title:title.data,p_description:description.data,p_config:config});
  if(error) redirect(`/studio/templates?profile=${encodeURIComponent(profile.data)}&tab=create&error=${error.code==="P1201"?"limit":"save"}`);
  revalidatePath("/studio/templates");
  redirect(`/studio/templates?profile=${encodeURIComponent(profile.data)}&tab=uploads&submitted=1`);
}

export async function reportCommunityTemplate(form: FormData) {
  const template=uuid.safeParse(form.get("template"));
  const reason=z.string().trim().min(8).max(500).safeParse(form.get("reason"));
  if(!template.success||!reason.success) redirect("/studio/templates?error=invalid");
  const {client}=await requireAccount(); const {error}=await client.rpc("report_community_template",{p_id:template.data,p_reason:reason.data});
  redirect(error?"/studio/templates?error=report":"/studio/templates?reported=1");
}
