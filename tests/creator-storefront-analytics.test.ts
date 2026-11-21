import { describe, expect, it } from "vitest";
import { creatorStorefrontAnalytics, formatTestPence } from "../src/lib/creator-storefront-analytics";
const days = Array.from({length:14},(_,i)=>({
  day: new Date(Date.UTC(2026,10,1+i)).toISOString().slice(0,10),
  orders:0,paid:0,grossTestPence:0,
}));
const empty = {
  retainedOrders:0,pendingOrders:0,expiredOrders:0,paidOrders:0,
  heldPaidOrders:0,downloadableOrders:0,grossTestPence:0,days,
};
describe("seller sandbox analytics contract",()=>{
  it("accepts an empty owner report without manufacturing sales",()=>{
    expect(creatorStorefrontAnalytics.parse(empty)).toEqual(empty);
    expect(formatTestPence(0)).toBe("£0.00");
  });
  it("formats precise GBP pence rather than labelling it as real revenue",()=>{
    expect(formatTestPence(501)).toBe("£5.01");
  });
  it("rejects cross-state inconsistent order totals",()=>{
    expect(creatorStorefrontAnalytics.safeParse({...empty,paidOrders:1}).success).toBe(false);
    expect(creatorStorefrontAnalytics.safeParse({...empty,retainedOrders:1,paidOrders:1,heldPaidOrders:1,downloadableOrders:1}).success).toBe(false);
  });
  it("rejects malformed or unbounded report data",()=>{
    expect(creatorStorefrontAnalytics.safeParse({...empty,days:[]}).success).toBe(false);
    expect(creatorStorefrontAnalytics.safeParse({...empty,grossTestPence:-1}).success).toBe(false);
    expect(creatorStorefrontAnalytics.safeParse({...empty,days:[...days.slice(0,13),{...days[13],day:"tomorrow"}]}).success).toBe(false);
    expect(creatorStorefrontAnalytics.safeParse({...empty,buyerId:"private"}).success).toBe(true); // unknown keys are stripped
    expect(creatorStorefrontAnalytics.parse({...empty,buyerId:"private"})).not.toHaveProperty("buyerId");
  });
});
