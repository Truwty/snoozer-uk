"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/actions";
import { affiliateDisclosureText } from "@/lib/creator-affiliate-disclosure";
import { requireAccount } from "@/lib/profiles-server";

export async function saveAffiliateDisclosure(_:ActionState,form:FormData):Promise<ActionState> {
  const input=z.object({
    profile:z.uuid(),expected:z.coerce.number().int().nonnegative().max(2147483646),
    disclosure:affiliateDisclosureText,enabled:z.boolean(),
  }).refine(v=>!v.enabled||v.disclosure.trim().length>0).safeParse({
    profile:form.get("profile"),expected:form.get("revision"),
    disclosure:form.get("disclosure"),enabled:form.get("enabled")==="on",
  });
  if(!input.success) return {status:"error",message:"Enter no more than 500 characters. An enabled disclosure must contain visible text."};
  const {client}=await requireAccount();
  const v=input.data;
  const result=await client.rpc("save_my_creator_affiliate_disclosure",{
    p_profile:v.profile,p_expected:v.expected,
    p_disclosure:v.disclosure,p_enabled:v.enabled,
  });
  if(result.error) return {status:"error",message:result.error.code==="40001"
    ?"Disclosure was changed in another window. Reload before saving."
    :result.error.code==="42501"
    ?"You cannot edit another profile's disclosure."
    :"Could not update the disclosure. Reload and try again."};
  if(result.data!==true) return {status:"error",message:"The disclosure update could not be confirmed."};
  revalidatePath("/studio/products/disclosure");
  return {status:"success",message:v.enabled
    ?"Disclosure saved and enabled for the eligible sandbox storefront. This is not legal approval."
    :"Disclosure saved privately. It is not displayed on the sandbox storefront."};
}
