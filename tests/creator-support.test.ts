import {describe,expect,it} from "vitest";
import {buyerSupportCases,staffSupportCases,supportInput,supportIssueLabels,supportMessage} from "../src/lib/creator-support";

describe("private commerce support contract",()=>{
 const id="00000000-0000-4000-8000-000000000001";
 const message="The sandbox PDF payment cannot be confirmed by my account.";
 const now="2026-11-21T16:00:00Z";
 it("enforces owned UUID references and bounded structured messages",()=>{
  expect(supportInput.safeParse({kind:"purchase",reference:id,issue:"payment",message}).success).toBe(true);
  for(const input of [{kind:"other"},{reference:"not-a-uuid"},{issue:"admin"},{message:"card number 123"}]){
   expect(supportInput.safeParse({kind:"purchase",reference:id,issue:"payment",message,...input}).success).toBe(false);
  }
  expect(supportMessage.safeParse("x".repeat(1501)).success).toBe(false);
  expect(supportIssueLabels.dispute).toContain("risk");
 });
 it("validates private staff and buyer history without payment credentials",()=>{
  const c={id,referenceKind:"purchase",referenceId:id,issue:"payment",message,state:"answered",
   response:"We can confirm your request has reached the team.",createdAt:now,answeredAt:now,
   updatedAt:now,closedAt:null};
  expect(buyerSupportCases.safeParse([c]).success).toBe(true);
  expect(staffSupportCases.safeParse([{...c,buyerId:id}]).success).toBe(true);
  expect(buyerSupportCases.safeParse([{...c,state:"answered",response:null}]).success).toBe(false);
  expect(buyerSupportCases.safeParse(Array.from({length:41},()=>c)).success).toBe(false);
 });
});
