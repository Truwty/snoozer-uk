import {EventEmitter} from "node:events";
import {describe,it,expect,vi} from "vitest";
import {buildZohoMessage,sendZohoNotice,zohoSmtpConfigured} from "./zoho-transport";

class FakeSmtp extends EventEmitter{
 encrypted=true;
 authorized=true;
 writes:string[]=[];
 destroyed=false;
 code=250;
 failAt="";
 constructor(){
  super();
  queueMicrotask(()=>{this.emit("secureConnect");this.emit("data",Buffer.from("220 Zoho ready\r\n"));});
 }
 setTimeout(){return this;}
 write(data:string){
  this.writes.push(data);
  const command=data.startsWith("EHLO ")?"EHLO":data.startsWith("AUTH PLAIN ")?"AUTH":
   data.startsWith("MAIL FROM:")?"MAIL":data.startsWith("RCPT TO:")?"RCPT":
   data==="DATA\r\n"?"DATA":data.endsWith(".\r\n")?"BODY":"QUIT";
  const reply=this.failAt===command?"550 rejected\r\n":
   command==="EHLO"?"250-Hello\r\n250 AUTH PLAIN\r\n":
   command==="AUTH"?"235 authenticated\r\n":
   command==="DATA"?"354 go ahead\r\n":
   command==="BODY"?"250 queued\r\n":
   command==="QUIT"?"221 bye\r\n":"250 OK\r\n";
  queueMicrotask(()=>this.emit("data",Buffer.from(reply)));
  return true;
 }
 destroy(){this.destroyed=true;return this;}
}
describe("Zoho Owner SMTP transport",()=>{
 const args=["verified@example.com","Account notice","Your account was changed.",
   "snoozersupport@snoozer.uk","test-app-password","snoozersupport@snoozer.uk"] as const;
 it("sends encrypted authenticated messages without leaking credentials into headers",async()=>{
  const socket=new FakeSmtp();
  const connector=vi.fn(()=>socket);
  expect(await sendZohoNotice(...args,connector as never)).toBe(true);
  expect(connector).toHaveBeenCalledWith(expect.objectContaining({
   host:"smtppro.zoho.uk",port:465,rejectUnauthorized:true,servername:"smtppro.zoho.uk"}));
  expect(socket.writes.some(x=>x.startsWith("AUTH PLAIN "))).toBe(true);
  expect(socket.writes.join("")).not.toContain("test-app-password");
  const msg=socket.writes.find(x=>x.includes("Content-Transfer-Encoding: base64"))??"";
  expect(msg).toContain("MIME-Version: 1.0");
  expect(msg).toContain("RCPT").toBe(false);
  expect(socket.destroyed).toBe(true);
 });
 it("rejects invalid addresses and header injection before connecting",async()=>{
  const connector=vi.fn(()=>new FakeSmtp());
  expect(await sendZohoNotice("bad",args[1],args[2],args[3],args[4],args[5],connector as never)).toBe(false);
  expect(await sendZohoNotice(args[0],"Bad\r\nBcc: victim@example.com",args[2],
   args[3],args[4],args[5],connector as never)).toBe(false);
  expect(connector).not.toHaveBeenCalled();
 });
 it("returns retryable failure on SMTP rejection",async()=>{
  const socket=new FakeSmtp();socket.failAt="RCPT";
  expect(await sendZohoNotice(...args,(()=>socket) as never)).toBe(false);
  expect(socket.destroyed).toBe(true);
 });
 it("correctly encodes non-ASCII subject and body",()=>{
  const wire=buildZohoMessage(args[5],args[0],"Ação","Olá\nSupport");
  expect(wire).toContain("Subject: =?UTF-8?B?");
  const encoded=wire.split("\r\n\r\n")[1];
  expect(Buffer.from(encoded.replace(/\s/g,""),"base64").toString()).toContain("Olá");
 });
 it("requires dedicated server-side credentials",()=>{
  const original={user:process.env.ZOHO_SMTP_USER,pass:process.env.ZOHO_SMTP_PASSWORD,
   from:process.env.SNOOZER_NOTIFICATION_FROM};
  try{
   delete process.env.ZOHO_SMTP_USER;delete process.env.ZOHO_SMTP_PASSWORD;
   process.env.SNOOZER_NOTIFICATION_FROM="snoozersupport@snoozer.uk";
   expect(zohoSmtpConfigured()).toBe(false);
   process.env.ZOHO_SMTP_USER="snoozersupport@snoozer.uk";
   process.env.ZOHO_SMTP_PASSWORD="app-password";
   expect(zohoSmtpConfigured()).toBe(true);
  }finally{
   for(const [name,value] of Object.entries({ZOHO_SMTP_USER:original.user,
     ZOHO_SMTP_PASSWORD:original.pass,SNOOZER_NOTIFICATION_FROM:original.from})){
    if(value===undefined)delete process.env[name];else process.env[name]=value;
   }
  }
 });
});
