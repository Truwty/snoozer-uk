import {connect as tlsConnect, type TLSSocket} from "node:tls";
import {z} from "zod";

// This is a separate server-side transport. Supabase Auth SMTP credentials
// cannot be read from the Auth dashboard by Next.js.
const SMTP_HOST="smtppro.zoho.uk";
const SMTP_PORT=465;
const address=z.email().max(254);
const heading=z.string().min(1).max(120).refine(v=>!/[\r\n]/.test(v));
const MAX_BODY=2500;

export function zohoSmtpConfigured(){
 return Boolean(address.safeParse(process.env.ZOHO_SMTP_USER).success &&
  typeof process.env.ZOHO_SMTP_PASSWORD==="string" &&
  process.env.ZOHO_SMTP_PASSWORD.length>0 &&
  address.safeParse(process.env.SNOOZER_NOTIFICATION_FROM).success);
}

export function buildZohoMessage(from:string,to:string,subject:string,body:string){
 const title="=?UTF-8?B?"+Buffer.from(subject,"utf8").toString("base64")+"?=";
 const text=body+"\n\nIf you need help, contact Snoozer support through the official website.";
 const encoded=Buffer.from(text,"utf8").toString("base64").replace(/.{1,76}/g,"$&\r\n").trimEnd();
 return ["From: Snoozer Support <"+from+">","To: <"+to+">","Subject: "+title,
  "Date: "+new Date().toUTCString(),"MIME-Version: 1.0",
  "Content-Type: text/plain; charset=UTF-8","Content-Transfer-Encoding: base64",
  "Auto-Submitted: auto-generated","",""+encoded].join("\r\n")+"\r\n";
}

export async function sendZohoNotice(
 to:string,subject:string,body:string,
 username=process.env.ZOHO_SMTP_USER??"",
 password=process.env.ZOHO_SMTP_PASSWORD??"",
 from=process.env.SNOOZER_NOTIFICATION_FROM??"",
 connector:typeof tlsConnect=tlsConnect,
):Promise<boolean>{
 const recipient=address.safeParse(to);
 const sender=address.safeParse(from);
 const account=address.safeParse(username);
 if(!recipient.success||!sender.success||!account.success||!password||
   password.length>4096||!heading.safeParse(subject).success||
   typeof body!=="string"||body.length>MAX_BODY)return false;
 const socket:TLSSocket=connector({host:SMTP_HOST,port:SMTP_PORT,
  servername:SMTP_HOST,rejectUnauthorized:true,timeout:10000});
 let done=false;
 let lineBuffer="";
 const lines:string[]=[];
 let waiting:{resolve:(v:string)=>void;reject:(err:Error)=>void}|null=null;
 const fail=(err:Error)=>{
  done=true;
  if(waiting){const w=waiting;waiting=null;w.reject(err);}
 };
 socket.on("data",(chunk:Buffer)=>{
  lineBuffer+=chunk.toString("utf8");
  if(lineBuffer.length>16384){socket.destroy();fail(new Error("SMTP response oversized"));return;}
  for(;;){
   const n=lineBuffer.indexOf("\r\n");
   if(n<0)break;
   const line=lineBuffer.slice(0,n);
   lineBuffer=lineBuffer.slice(n+2);
   if(line.length>2048){socket.destroy();fail(new Error("SMTP line too long"));return;}
   if(waiting){const w=waiting;waiting=null;w.resolve(line);}
   else {lines.push(line);if(lines.length>128){socket.destroy();fail(new Error("SMTP response overflow"));return;}}
  }
 });
 socket.on("error",()=>fail(new Error("SMTP transport error")));
 socket.on("timeout",()=>{socket.destroy();fail(new Error("SMTP timeout"));});
 socket.on("close",()=>fail(new Error("SMTP connection closed")));
 function readLine():Promise<string>{
  if(lines.length)return Promise.resolve(lines.shift()!);
  if(done)return Promise.reject(new Error("SMTP connection closed"));
  return new Promise((resolve,reject)=>{waiting={resolve,reject};});
 }
 async function response(expected:number[]){
  let count=0;let code="";
  while(count++<64){
   const line=await readLine();
   const match=/^(\d{3})([ -])/.exec(line);
   if(!match||code&&match[1]!==code)throw new Error("Invalid SMTP reply");
   code=match[1];
   if(match[2]===" "){
    if(!expected.includes(Number(code)))throw new Error("SMTP rejected command");
    return;
   }
  }
  throw new Error("Too many SMTP response lines");
 }
 async function command(value:string,expected:number[]){
  if(done)throw new Error("SMTP connection closed");
  socket.write(value+"\r\n");
  await response(expected);
 }
 try{
  // TLS is established before any credentials or message content are sent.
  await new Promise<void>((resolve,reject)=>{
   if(done){reject(new Error("SMTP connection closed"));return;}
   socket.once("secureConnect",()=>resolve());
   socket.once("error",()=>reject(new Error("TLS handshake failed")));
  });
  if(!socket.encrypted||!socket.authorized)throw new Error("Untrusted SMTP TLS certificate");
  await response([220]);
  await command("EHLO snoozer.uk",[250]);
  await command("AUTH PLAIN "+Buffer.from("\0"+account.data+"\0"+password).toString("base64"),[235]);
  await command("MAIL FROM:<"+sender.data+">",[250]);
  await command("RCPT TO:<"+recipient.data+">",[250,251]);
  await command("DATA",[354]);
  // Encoded body contains no SMTP terminator. The message ends at one dot line.
  socket.write(buildZohoMessage(sender.data,recipient.data,subject,body)+".\r\n");
  await response([250]);
  try{socket.write("QUIT\r\n");}catch{/* message already accepted */}
  return true;
 }catch{return false;}
 finally{socket.destroy();}
}
