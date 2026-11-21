import {describe,expect,it} from "vitest";
import {affiliateDisclosureText,creatorAffiliateDisclosure} from "../src/lib/creator-affiliate-disclosure";
describe("creator affiliate disclosure contract",()=>{
  it("accepts the private default state without fabricating relationships",()=>{
    expect(creatorAffiliateDisclosure.parse({revision:0,disclosure:"",enabled:false}))
      .toEqual({revision:0,disclosure:"",enabled:false});
  });
  it("requires visible text when switched on",()=>{
    expect(creatorAffiliateDisclosure.safeParse({revision:0,disclosure:"   ",enabled:true}).success).toBe(false);
    expect(creatorAffiliateDisclosure.safeParse({revision:1,disclosure:"Links may earn commission.",enabled:true}).success).toBe(true);
  });
  it("rejects unsafe control characters and excessive length",()=>{
    expect(affiliateDisclosureText.safeParse("Bad\u0000text").success).toBe(false);
    expect(affiliateDisclosureText.safeParse("x".repeat(501)).success).toBe(false);
    expect(affiliateDisclosureText.safeParse("Normal\ntext").success).toBe(true);
  });
  it("strips private data outside the public typed view",()=>{
    const parsed=creatorAffiliateDisclosure.parse({revision:0,disclosure:"Ad",enabled:true,buyerId:"secret"});
    expect(parsed).not.toHaveProperty("buyerId");
  });
});