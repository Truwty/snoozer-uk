import {describe,expect,it} from "vitest";
import {createProductReport,moderationDecision,ownProductReports,staffProductReports} from "../src/lib/creator-product-moderation";
const id="00000000-0000-4000-8000-000000000001";
const detail="The PDF appears to contain harmful content and needs review.";
const when="2026-11-21T17:00:00Z";
describe("reviewed product abuse report contract",()=>{
 it("accepts only private bounded, typed reports",()=>{
  expect(createProductReport.safeParse({versionId:id,reason:"malware",detail}).success).toBe(true);
  for(const v of [{versionId:"not-uuid"},{reason:"bypass"},{detail:"short"},{detail:"x".repeat(1201)}]){
   expect(createProductReport.safeParse({versionId:id,reason:"malware",detail,...v}).success).toBe(false);
  }
  expect(moderationDecision.safeParse("quarantine").success).toBe(true);
  expect(moderationDecision.safeParse("release").success).toBe(false);
 });
 it("keeps public reports distinct from staff queue metadata",()=>{
  const report={id,versionId:id,reason:"malware",detail,createdAt:when};
  expect(ownProductReports.safeParse([{...report,state:"open",reviewedAt:null}]).success).toBe(true);
  expect(staffProductReports.safeParse([{...report,reporterId:id,ownerId:id,productTitle:"QA PDF"}]).success).toBe(true);
  expect(staffProductReports.safeParse([{...report,reporterId:id,ownerId:id,productTitle:""}]).success).toBe(false);
 });
});
