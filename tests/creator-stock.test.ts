import {describe,expect,it} from "vitest";
import {publicStock,sellerStock,stockState} from "../src/lib/creator-stock";
const versionId="00000000-0000-4000-8000-000000000001";
const row={versionId,title:"Test PDF",revision:0,totalSlots:2,reserved:1};
describe("frozen sandbox inventory contract",()=>{
  it("bounds owner stock data and shows reserved slots, not paid sales",()=>{
    expect(sellerStock.parse([row])).toHaveLength(1);
    expect(stockState(row)).toBe("1 of 2 unreserved slots");
    expect(stockState({...row,totalSlots:null,reserved:0})).toBe("Unlimited");
  });
  it("rejects over-reservation, negative stock and caps above fifty",()=>{
    expect(sellerStock.safeParse([{...row,reserved:3}]).success).toBe(false);
    expect(sellerStock.safeParse([{...row,reserved:-1}]).success).toBe(false);
    expect(sellerStock.safeParse([{...row,totalSlots:51}]).success).toBe(false);
    expect(sellerStock.safeParse([{...row,totalSlots:null,reserved:1}]).success).toBe(false);
  });
  it("returns only bounded public version/remaining records",()=>{
    const parsed=publicStock.parse([{versionId,remaining:0,buyerId:"secret",ownerId:"private"}]);
    expect(parsed).toEqual([{versionId,remaining:0}]);
    expect(publicStock.safeParse([{versionId,remaining:51}]).success).toBe(false);
  });
});
