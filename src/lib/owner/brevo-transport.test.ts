import {describe,it,expect,vi} from "vitest";
import {sendBrevoNotice} from "./brevo-transport";
describe("transactional notice transport",()=>{
 const args=["verified@example.com","Account notice","A platform action occurred.","test-api-key","support@example.com"] as const;
 it("sends fixed Brevo endpoint and plaintext content",async()=>{
  const send=vi.fn(async()=>new Response("{}",{status:201})) as unknown as typeof fetch;
  expect(await sendBrevoNotice(...args,send)).toBe(true);
  expect(send).toHaveBeenCalledTimes(1);
  const [url,options]=(send as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(url).toBe("https://api.brevo.com/v3/smtp/email");
  expect(JSON.parse(options.body)).toMatchObject({to:[{email:"verified@example.com"}],sender:{email:"support@example.com"}});
  expect(JSON.parse(options.body).textContent).toContain("A platform action occurred.");
 });
 it("rejects invalid recipients or senders without network calls",async()=>{
  const send=vi.fn(async()=>new Response("{}",{status:201})) as unknown as typeof fetch;
  expect(await sendBrevoNotice("bad-address",args[1],args[2],args[3],args[4],send)).toBe(false);
  expect(await sendBrevoNotice(args[0],args[1],args[2],args[3],"invalid",send)).toBe(false);
  expect(send).not.toHaveBeenCalled();
 });
 it("treats provider errors and timeouts as retryable failures",async()=>{
  const bad=vi.fn(async()=>new Response("no",{status:429})) as unknown as typeof fetch;
  expect(await sendBrevoNotice(...args,bad)).toBe(false);
  const timeout=vi.fn(async()=>{throw new Error("timeout");}) as unknown as typeof fetch;
  expect(await sendBrevoNotice(...args,timeout)).toBe(false);
 });
});
