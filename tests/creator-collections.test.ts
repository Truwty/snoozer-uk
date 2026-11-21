import { describe,expect,it } from "vitest";
import { collectionTitle,collectionDescription,creatorCollections,publicCreatorCollections } from "../src/lib/creator-collections";

const c="00000000-0000-4000-8000-000000000001";
const p="00000000-0000-4000-8000-000000000002";
const v="00000000-0000-4000-8000-000000000003";
const owned={id:c,revision:0,title:"PDF guides",description:"Helpful guides",visible:false,productIds:[p]};
describe("creator collection contract",()=>{
 it("accepts an empty private catalogue, and a valid bounded owner group",()=>{
   expect(creatorCollections.parse([])).toEqual([]);
   expect(creatorCollections.parse([owned])).toHaveLength(1);
 });
 it("blocks duplicate products, excess groups and unsafe/control titles",()=>{
   expect(creatorCollections.safeParse([{...owned,productIds:[p,p]}]).success).toBe(false);
   expect(creatorCollections.safeParse(Array.from({length:6},()=>owned)).success).toBe(false);
   expect(collectionTitle.safeParse("<script>text</script>").success).toBe(true);
   expect(collectionTitle.safeParse("bad\nname").success).toBe(false);
   expect(collectionDescription.safeParse("x".repeat(501)).success).toBe(false);
 });
 it("parses only public version references, stripping metadata not intended for buyers",()=>{
   const publicRow={id:c,title:"PDF guides",description:"",versionIds:[v],ownerId:p,chargeId:"ch_private"};
   const parsed=publicCreatorCollections.parse([publicRow]);
   expect(parsed[0]).toEqual({id:c,title:"PDF guides",description:"",versionIds:[v]});
   expect(JSON.stringify(parsed)).not.toContain("ch_private");
   expect(JSON.stringify(parsed)).not.toContain("ownerId");
 });
 it("rejects empty public groups and too many disclosed versions",()=>{
   expect(publicCreatorCollections.safeParse([{id:c,title:"X",description:"",versionIds:[]}]).success).toBe(false);
   expect(publicCreatorCollections.safeParse([{id:c,title:"X",description:"",versionIds:Array(6).fill(v)}]).success).toBe(false);
 });
});
