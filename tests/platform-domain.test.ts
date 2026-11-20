import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";
vi.mock("server-only",()=>({}));
vi.mock("../src/lib/domains-server",()=>({refreshDomain:vi.fn()}));
beforeEach(()=>{
  vi.stubEnv("NEXT_PUBLIC_SITE_URL","https://snoozer.uk");
  vi.stubEnv("RENDER_EXTERNAL_HOSTNAME","snoozer-uk-staging.onrender.com");
});
afterEach(()=>vi.unstubAllEnvs());
const request=(host:string,path="/",method="GET")=>new NextRequest("https://"+host+path,{method,headers:{host}});
it("keeps the canonical domain and redirects Render browser visits with their path and query",async()=>{
  expect((await proxy(request("snoozer.uk"))).headers.get("x-middleware-next")).toBe("1");
  for(const method of ["GET","HEAD"]) {
    const response=await proxy(request("snoozer-uk-staging.onrender.com","/sign-in?from=domain",method));
    expect(response.status).toBe(308);expect(response.headers.get("location")).toBe("https://snoozer.uk/sign-in?from=domain");
    expect(response.headers.get("cache-control")).toContain("no-store");
  }
});
it("preserves existing provider callbacks and the domain marker on the exact deployment hostname",async()=>{
  for(const [path,method] of [["/api/v1/commerce/stripe/webhook","POST"],["/api/v1/billing/kofi/webhook","POST"],
    ["/api/v1/commerce/stripe/recover","POST"],["/api/v1/usernames/test-name","GET"],["/.well-known/snoozer-domain","GET"]]) {
    const response=await proxy(request("snoozer-uk-staging.onrender.com",path,method));
    expect(response.headers.get("location")).toBeNull();expect(response.headers.get("x-middleware-next")).toBe("1");
  }
});
it("does not trust similar hosts or a forged forwarded hostname as a platform alias",async()=>{
  for(const host of ["snoozer-uk-staging.onrender.com.evil.example","www.evil.example"]) {
    const response=await proxy(new NextRequest("https://"+host+"/studio",{headers:{host,"x-forwarded-host":"snoozer.uk"}}));
    expect(response.status).toBe(404);expect(response.headers.get("location")).toBeNull();
  }
  vi.stubEnv("RENDER_EXTERNAL_HOSTNAME","");expect((await proxy(request("snoozer-uk-staging.onrender.com","/studio"))).status).toBe(404);
});
