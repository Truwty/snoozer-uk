import Link from "next/link";
import { z } from "zod";
import { requireOwner } from "@/lib/owner/auth";
import { ownerAwardBadge, ownerRevokeBadge } from "./actions";
import { BadgeArtwork } from "@/components/badge-artwork";

export const metadata={title:"Owner · Official badges",robots:{index:false,follow:false}};
const uuid=z.uuid();
const people=z.array(z.object({id:uuid,email:z.string().nullable(),verified:z.boolean(),created_at:z.string(),profile_count:z.number(),restricted:z.boolean(),is_owner:z.boolean()}));
const detail=z.object({id:uuid,email:z.string().nullable(),verified:z.boolean(),created_at:z.string(),is_owner:z.boolean(),
 profiles:z.array(z.object({id:uuid,username:z.string(),published:z.boolean()}))});
const catalogue=z.array(z.object({slug:z.string(),name:z.string(),description:z.string(),icon:z.string(),category:z.string(),
 rarity:z.string(),award_mode:z.string(),enabled:z.boolean()}));
const awards=z.array(z.object({id:uuid,slug:z.string(),name:z.string(),description:z.string(),icon:z.string(),
 category:z.string(),rarity:z.string(),source:z.string(),award_reason:z.string().nullable(),revoked_at:z.string().nullable(),awarded_at:z.string()}));

export default async function OwnerBadges({searchParams}:{searchParams:Promise<{q?:string;user?:string;status?:string}>}){
 const params=await searchParams; const q=(params.q??"").trim().slice(0,120);
 const selected=uuid.safeParse(params.user);
 const {client}=await requireOwner();
 const [catalogueResult,searchResult]=await Promise.all([
  client.rpc("owner_badge_catalog"),
  q.length>=2?client.rpc("owner_user_search",{p_query:q,p_limit:30}):Promise.resolve({data:[],error:null}),
 ]);
 const badges=catalogue.safeParse(catalogueResult.data);
 const users=people.safeParse(searchResult.data);
 let target: z.infer<typeof detail>|null=null;
 let profileAwards: {profile:{id:string;username:string;published:boolean};badges:z.infer<typeof awards>}[]=[];
 if(selected.success){
  const found=await client.rpc("owner_user_detail",{p_user:selected.data});
  const parsed=detail.safeParse(found.data);
  if(parsed.success){
   target=parsed.data;
   const results=await Promise.all(target.profiles.map(async profile=>{
    const result=await client.rpc("owner_profile_badges",{p_profile:profile.id});
    const parsedAwards=awards.safeParse(result.data);
    return {profile,badges:parsedAwards.success?parsedAwards.data:[]};
   }));
   profileAwards=results;
  }
 }
 const usable=badges.success?badges.data.filter(b=>b.enabled&&(b.award_mode==="manual"||b.award_mode==="future") ):[];

 return <main className="stack owner-badges-page">
  <header className="stack">
   <p className="eyebrow">OWNER / RECOGNITION</p><h1>Official badge manager</h1>
   <p className="muted">Search a Snoozer account, choose one of its profiles and issue or revoke official recognition. Every write requires Owner MFA (AAL2) and creates an audit event.</p>
  </header>
  {params.status==="awarded"&&<p role="status">Badge awarded and audit recorded.</p>}
  {params.status==="revoked"&&<p role="status">Badge revoked and audit recorded.</p>}
  {params.status==="denied"&&<p role="alert">The badge operation was denied. Complete Owner MFA and check the selected profile and reason.</p>}
  {params.status==="invalid"&&<p role="alert">Check the award fields and enter a reason of at least eight characters.</p>}
  <section className="panel stack">
   <h2>Find an account</h2>
   <form className="actions" action="/owner/badges">
    <label htmlFor="badge-search">Email, username or user ID</label>
    <input id="badge-search" name="q" defaultValue={q} maxLength={120} placeholder="Search accounts"/>
    <button className="button" type="submit">Search</button>
   </form>
   {q.length>0&&q.length<2&&<p className="muted">Enter at least two characters.</p>}
   {q.length>=2&&(!users.success||searchResult.error)?<p role="alert">Account search is unavailable.</p>:q.length>=2&&users.success&&
    (users.data.length===0?<p>No matching accounts.</p>:<div className="owner-badge-account-results">
     {users.data.map(person=><Link key={person.id} href={"/owner/badges?"+new URLSearchParams({q,user:person.id})} className={"owner-badge-account"+(selected.success&&selected.data===person.id?" is-selected":"")}>
      <strong>{person.email??person.id}</strong><small>{person.profile_count} profile(s) · {person.verified?"Verified":"Unverified"}{person.is_owner?" · Owner":""}</small>
     </Link>)}
    </div>)}
  </section>
  {selected.success&&!target&&<p role="alert">That account could not be found or its details are unavailable.</p>}
  {target&&<section className="panel stack">
   <div><p className="eyebrow">SELECTED ACCOUNT</p><h2>{target.email??target.id}</h2><p className="muted"><code>{target.id}</code> · {target.is_owner?"Owner account":"Member account"}</p></div>
   {target.profiles.length===0?<p>This account has no profile to award.</p>:profileAwards.map(({profile,badges:earned})=><article key={profile.id} className="owner-badge-profile stack">
    <div><h3>@{profile.username}</h3><p className="muted">{profile.published?"Published profile":"Draft profile"} · <code>{profile.id}</code></p></div>
    <div className="owner-badge-earned-list">
     {earned.filter(b=>!b.revoked_at).map(b=><div className="owner-badge-earned" key={b.id}>
      <span aria-hidden="true"><BadgeArtwork slug={b.slug} size={30}/></span><div><strong>{b.name}</strong><small>{b.rarity} · {b.source==="owner"?"Owner award":target!.is_owner?"Owner collection":"Automatic award"}</small>{b.award_reason&&<small>Reason: {b.award_reason}</small>}</div>
      {b.source==="owner"&&<form action={ownerRevokeBadge}><input type="hidden" name="user" value={target!.id}/><input type="hidden" name="profile" value={profile.id}/><input type="hidden" name="badge" value={b.id}/>
       <input name="reason" required minLength={8} maxLength={500} placeholder="Reason for revocation" aria-label={"Reason for revoking "+b.name}/>
       <button className="button small danger" type="submit">Revoke</button>
      </form>}
     </div>)}
     {earned.every(b=>b.revoked_at)&&<p className="muted">No active badges on this profile yet.</p>}
    </div>
    <div className="owner-badge-award-grid">
     <form action={ownerAwardBadge} className="stack">
      <h4>Award an official or future badge</h4>
      <input type="hidden" name="user" value={target.id}/><input type="hidden" name="profile" value={profile.id}/>
      <label>Badge catalogue<select name="slug" required defaultValue=""><option value="" disabled>Select a badge</option>
       {usable.map(b=><option key={b.slug} value={b.slug}>{b.name} · {b.award_mode==="future"?"Future":"Official"} · {b.rarity}</option>)}
      </select></label>
      <label>Reason (audited)<textarea name="reason" required minLength={8} maxLength={500}/></label>
      <input type="hidden" name="name" value=""/><input type="hidden" name="description" value=""/><input type="hidden" name="icon" value=""/>
      <input type="hidden" name="category" value="community"/><input type="hidden" name="rarity" value="rare"/>
      <button className="button" type="submit">Award selected badge</button>
     </form>
     <form action={ownerAwardBadge} className="stack">
      <h4>Create a unique one-off badge</h4>
      <input type="hidden" name="user" value={target.id}/><input type="hidden" name="profile" value={profile.id}/><input type="hidden" name="slug" value=""/>
      <label>Badge name<input name="name" minLength={2} maxLength={48} required/></label>
      <label>Description<input name="description" minLength={8} maxLength={240} required/></label>
      <div className="owner-badge-artwork-field"><span>Badge artwork</span><BadgeArtwork slug="unique" size={42}/><small>One-off badges use Snoozer’s matching vector artwork.</small><input type="hidden" name="icon" value="✦"/></div>
      <div className="actions">
       <label>Category<select name="category"><option value="unique">Unique</option><option value="staff">Staff</option><option value="community">Community</option><option value="creator">Creator</option></select></label>
       <label>Rarity<select name="rarity"><option value="mythic">Mythic</option><option value="legendary">Legendary</option><option value="epic">Epic</option><option value="rare">Rare</option></select></label>
      </div>
      <label>Reason (audited)<textarea name="reason" required minLength={8} maxLength={500}/></label>
      <button className="button" type="submit">Create and award unique badge</button>
     </form>
    </div>
   </article>)}
  </section>}
  <section className="panel stack">
   <h2>Badge catalogue</h2><p className="muted">{badges.success?badges.data.length:"—"} entries. Automatic criteria are awarded by the database. Manual and future entries can be issued from the profile controls above.</p>
   {badges.success&&<div className="owner-badge-catalogue">{badges.data.map(item=><article key={item.slug}><span aria-hidden="true"><BadgeArtwork slug={item.slug} size={30}/></span><div><strong>{item.name}</strong><small>{item.category} · {item.rarity} · {item.award_mode}</small><p>{item.description}</p></div></article>)}</div>}
  </section>
 </main>;
}
