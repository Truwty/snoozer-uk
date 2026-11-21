import {describe,expect,it} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {creatorTipUrl} from "../src/lib/creator-tips";
import {CreatorTipPanel} from "../src/components/creator-tip-panel";

describe("external creator Ko-fi tipping link",()=>{
  it("uses an existing published Ko-fi profile link and no custom checkout",()=>{
    const href=creatorTipUrl([{url:"https://example.com"},{url:"https://www.ko-fi.com/Creator_42/"}]);
    expect(href).toBe("https://ko-fi.com/Creator_42");
    const html=renderToStaticMarkup(createElement(CreatorTipPanel,{href}));
    expect(html).toContain("Support this creator");
    expect(html).toContain('href="https://ko-fi.com/Creator_42"');
    expect(html).toContain("Ko-fi may charge real money");
    expect(html).toContain("do not buy this PDF");
    expect(html).not.toContain("checkout.stripe.com");
  });
  it("fails closed for no Ko-fi published link or lookalike URLs",()=>{
    expect(creatorTipUrl([])).toBeNull();
    expect(creatorTipUrl([{url:"https://ko-fi.com.evil.example/creator"}])).toBeNull();
    expect(creatorTipUrl([{url:"http://ko-fi.com/creator"}])).toBeNull();
    expect(creatorTipUrl([{url:"https://ko-fi.com/creator?fake=redirect"}])).toBeNull();
    expect(renderToStaticMarkup(createElement(CreatorTipPanel,{href:null}))).toBe("");
    expect(renderToStaticMarkup(createElement(CreatorTipPanel,{href:"javascript:alert(1)"}))).toBe("");
  });
  it("uses only the first trusted Ko-fi profile and ignores malicious preceding links",()=>{
    expect(creatorTipUrl([{url:"https://ko-fi.com@evil.example/"},{url:"https://ko-fi.com/genuine"}]))
      .toBe("https://ko-fi.com/genuine");
  });
});
