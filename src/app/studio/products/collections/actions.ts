"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/actions";
import { collectionDescription, collectionTitle } from "@/lib/creator-collections";
import { requireAccount } from "@/lib/profiles-server";

export async function saveCreatorCollection(_:ActionState, form:FormData):Promise<ActionState> {
  const ids=form.getAll("products");
  const input=z.object({
    profile:z.uuid(),id:z.uuid().nullable(),
    expected:z.coerce.number().int().nonnegative().max(2147483646),
    title:collectionTitle,description:collectionDescription,
    visible:z.boolean(),delete:z.boolean(),
    products:z.array(z.uuid()).max(5).refine(items=>new Set(items).size===items.length),
  }).safeParse({
    profile:form.get("profile"),id:form.get("id")||null,expected:form.get("revision"),
    title:form.get("title"),description:form.get("description"),
    visible:form.get("visible")==="on",delete:form.get("intent")==="delete",
    products:ids,
  });
  if(!input.success) return {status:"error",message:"Enter a collection title (1–80 characters), a description up to 500 characters and up to five distinct products."};
  const {client}=await requireAccount();
  const v=input.data;
  const result=await client.rpc("save_my_creator_collection",{
    p_profile:v.profile,p_id:v.id,p_expected:v.expected,
    p_title:v.title,p_description:v.description,p_visible:v.visible,
    p_products:v.products,p_delete:v.delete,
  });
  if(result.error) return {status:"error",message:
    result.error.code==="40001"?"Collection changed in another window. Reload before saving."
    :result.error.code==="P1201"?"Each profile supports up to five collections."
    :result.error.code==="42501"?"This collection or one of its products is not in your profile."
    :"Could not save collection. Reload and try again."};
  if(!z.uuid().safeParse(result.data).success) return {status:"error",message:"Collection save could not be confirmed. Reload before retrying."};
  revalidatePath("/studio/products/collections");
  return {status:"success",message:v.delete?"Collection removed. Frozen files, reviews and purchases were not changed.":"Collection saved. Only independently reviewed and eligible test products can appear publicly."};
}
