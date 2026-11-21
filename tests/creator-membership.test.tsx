import {expect,it} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {membershipPrice,ownerMembershipOffers,publicMembershipOffers} from "../src/lib/creator-membership";
import {CreatorMembershipPanel} from "../src/components/creator-membership-panel";
const item={id:"00000000-0000-4000-8000-000000000001",title:"Supporter",benefits:"Monthly updates",monthlyPence:500};
it("bounds prices, text, tier count and public disclosure",()=>{
  expect(membershipPrice.parse("5.25")).toBe(525);
  for(const invalid of ["0.99","100.01","1e1","-5","3.001"]) expect(membershipPrice.safeParse(invalid).success).toBe(false);
  expect(publicMembershipOffers.safeParse(Array(6).fill(item)).success).toBe(false);
  expect(publicMembershipOffers.safeParse([{...item,benefits:" "}]).success).toBe(false);
  expect(ownerMembershipOffers.safeParse([{...item,revision:0,benefits:"",visible:false}]).success).toBe(true);
  expect(publicMembershipOffers.parse([{...item,ownerId:"private",revision:2}])).toEqual([item]);
});
it("renders escaped proposal content without purchase controls",()=>{
  const html=renderToStaticMarkup(createElement(CreatorMembershipPanel,{offers:[{...item,title:"<script>test</script>"}]}));
  expect(html).toContain("£5.00");expect(html).toContain("not available for purchase");
  expect(html).toContain("&lt;script&gt;");expect(html).not.toContain("<script>");expect(html).not.toContain("<form");
  expect(renderToStaticMarkup(createElement(CreatorMembershipPanel,{offers:[]}))).toBe("");
  expect(renderToStaticMarkup(createElement(CreatorMembershipPanel,{offers:[{...item,monthlyPence:-1}]}))).toBe("");
});
