import { describe,expect,it } from "vitest";
import { createDiscountInput,discountCode,optionalDiscountCode,sellerDiscounts } from "../src/lib/creator-discounts";

describe("creator sandbox discount contracts",()=>{
  it("normalises only ASCII codes and separates no code from invalid code",()=>{
    expect(discountCode.parse(" save-20 ")).toBe("SAVE-20");
    expect(optionalDiscountCode.parse("")).toBeNull();
    for(const code of ["AB","-SAVE","a b","ＡBC","aßb","a/b","A".repeat(25),"SAVE\n20"]) expect(discountCode.safeParse(code).success).toBe(false);
  });
  it("bounds form inputs",()=>{
    const input={profile:"11111111-1111-4111-8111-111111111111",version:"22222222-2222-4222-8222-222222222222",code:"save20",percent:"20",uses:"5",days:"7"};
    expect(createDiscountInput.parse(input)).toMatchObject({code:"SAVE20",percent:20,uses:5,days:7});
    for(const patch of [{percent:"0"},{percent:"91"},{percent:"1.5"},{uses:"51"},{days:"31"},{uses:"1e1"}]) expect(createDiscountInput.safeParse({...input,...patch}).success).toBe(false);
  });
  it("rejects impossible redemption counts",()=>{
    expect(sellerDiscounts.parse({versions:[],codes:[]})).toEqual({versions:[],codes:[]});
    const code={id:"11111111-1111-4111-8111-111111111111",versionId:"22222222-2222-4222-8222-222222222222",title:"Guide",code:"SAVE20",percentOff:20,maxUses:1,used:2,expiresAt:"2026-11-22T00:00:00Z",disabled:false};
    expect(sellerDiscounts.safeParse({versions:[],codes:[code]}).success).toBe(false);
  });
});
