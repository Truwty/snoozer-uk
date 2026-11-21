"use server";
import {createHash} from "node:crypto";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import type {ActionState} from "@/lib/actions";
import {creatorKofiToken} from "@/lib/creator-kofi-reporting";
import {requireAccount} from "@/lib/profiles-server";

export async function saveCreatorKofiHook(_:ActionState,form:FormData):Promise<ActionState> {
 const profile=z.uuid().safeParse(form.get("profile"));
 const revision=z.coerce.number().int().min(0).max(2147483640).safeParse(form.get("revision"));
 const enabled=form.get("intent")==="enable";
 const raw=String(form.get("token")??"").trim();
 const token=raw?creatorKofiToken.safeParse(raw):null;
 if(!profile.success||!revision.success||token&&!token.success) return {status:"error",message:"Enter a valid profile and the Ko-fi verification token (16–128 characters), or disable reporting."};
 const digest=token?.success?createHash("sha256").update(token.data).digest("hex"):null;
 const {client}=await requireAccount();
 const result=await client.rpc("save_my_creator_kofi_hook",{p_profile:profile.data,p_expected:revision.data,p_digest:digest,p_enabled:enabled});
 if(result.error||typeof result.data!=="number") return {status:"error",message:result.error?.code==="40001"?"The settings changed. Reload, then enter your token again.":"Ko-fi reporting could not be saved. Ensure you own the profile and provide your token before enabling."};
 revalidatePath("/studio/donations");
 return {status:"success",message:enabled?"Ko-fi notification reporting enabled for this profile. Set the webhook URL in your own Ko-fi account; reported payments are not verified settlement.":"Ko-fi notification reporting disabled. Previously recorded notifications remain private."};
}
