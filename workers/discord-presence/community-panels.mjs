import { DiscordServerRebuilder } from "./server-rebuilder.mjs";

const P={administrator:1n<<3n,manageChannels:1n<<4n,manageMessages:1n<<13n,embedLinks:1n<<14n,readMessageHistory:1n<<16n,kickMembers:1n<<1n,banMembers:1n<<2n,moderateMembers:1n<<40n};
const SF=/^[1-9][0-9]{16,19}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean=(v,n=1000)=>typeof v==="string"?v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,"").trim().slice(0,n):"";
const uid=i=>i.member?.user?.id??i.user?.id??"";
const opt=(i,n)=>i.data?.options?.find(x=>x.name===n)?.value;
const row=(...components)=>({type:1,components});
const btn=(id,label,style=2,emoji)=>({type:2,style,custom_id:id,label,...(emoji?{emoji:{name:emoji}}:{})});
const link=(url,label,emoji)=>({type:2,style:5,url,label,...(emoji?{emoji:{name:emoji}}:{})});
const select=(id,placeholder,options,min=1,max=1)=>({type:3,custom_id:id,placeholder,min_values:min,max_values:max,options});
const input=(id,label,min,max,style=1,placeholder="")=>({type:4,custom_id:id,label,style,required:true,min_length:min,max_length:max,placeholder});
const mkModal=(id,title,fields)=>({custom_id:id,title,components:fields.map(f=>row(input(f.id,f.label,f.min,f.max,f.style??1,f.placeholder??"")))});
const has=(v,p)=>{try{const b=BigInt(v??"0");return (b&P.administrator)===P.administrator||(b&p)===p;}catch{return false;}};
const STAFF=["admin","senior_moderator","moderator","support_manager","support_team","ticket_support"];
const FOOTER=k=>"SNOOZER_PANEL:"+k+":v2";

export const SNOOZER_REBUILD_COMMAND={
  name:"snoozer-rebuild-server",description:"Replace the current server layout with the approved Snoozer design.",
  type:1,default_member_permissions:"8",
  options:[{type:3,name:"confirmation",description:"Type REBUILD SNOOZER SERVER to confirm.",required:true,min_length:21,max_length:21}],
};

export class DiscordCommunityPanels{
  constructor(config,deps={}){
    this.guildId=config.guildId;this.botUserId=config.botUserId;this.applicationId=config.applicationId;
    this.api=deps.api;this.store=deps.store;this.logger=deps.logger??console;
    this.resources={};this.roleIds={};this.rebuilder=deps.rebuilder??new DiscordServerRebuilder(config,{
      api:this.api,store:this.store,logger:this.logger,onPanelsReady:()=>this.publishPermanentPanels(),
    });
    this.timer=null;this.busy=false;this.lastRoleSync=0;
  }
  async refreshResources(){
    const r=await this.store.getResources(this.guildId);this.resources=r.map??{};this.roleIds={};
    for(const [k,v] of Object.entries(this.resources))if(k.startsWith("role_"))this.roleIds[k.slice(5)]=v;
    return this.resources;
  }
  staff(i,keys=STAFF){
    if(has(i.member?.permissions,P.administrator)||has(i.member?.permissions,P.manageMessages))return true;
    const roles=new Set(i.member?.roles??[]);return keys.some(k=>this.roleIds[k]&&roles.has(this.roleIds[k]));
  }
  requireStaff(i,keys=STAFF){if(!this.staff(i,keys))throw new Error("You do not have permission to use this staff control.");}
  async reply(i,payload,ephemeral=true){return this.api.request("/interactions/"+i.id+"/"+i.token+"/callback",{method:"POST",auth:false,body:{type:4,data:{flags:ephemeral?64:0,allowed_mentions:{parse:[]},...payload}}});}
  async defer(i){return this.api.request("/interactions/"+i.id+"/"+i.token+"/callback",{method:"POST",auth:false,body:{type:5,data:{flags:64}}});}
  async showModal(i,data){return this.api.request("/interactions/"+i.id+"/"+i.token+"/callback",{method:"POST",auth:false,body:{type:9,data}});}
  async complete(i,payload){return this.api.request("/webhooks/"+this.applicationId+"/"+i.token+"/messages/@original",{method:"PATCH",auth:false,body:{allowed_mentions:{parse:[]},...payload}});}
  async upsertPanel(channelId,key,embed,components){
    if(!SF.test(channelId??""))return false;
    const messages=await this.api.request("/channels/"+channelId+"/messages?limit=100");
    const old=Array.isArray(messages)?messages.find(m=>m.author?.id===this.botUserId&&m.embeds?.some(e=>e.footer?.text===FOOTER(key))):null;
    const body={embeds:[{...embed,footer:{text:FOOTER(key)}}],components,allowed_mentions:{parse:[]}};
    if(old?.id)await this.api.request("/channels/"+channelId+"/messages/"+old.id,{method:"PATCH",body});
    else await this.api.request("/channels/"+channelId+"/messages",{method:"POST",body});
    return true;
  }
  async publishPermanentPanels(){
    await this.refreshResources();
    const definitions=[
      ["getting_started","getting_started",{title:"Welcome to Snoozer",description:"Your guide to the Snoozer platform and community.\n\nRead the rules, explore the community and use the member hub to connect your account.",color:0x8b72d9,fields:[{name:"Website",value:"https://snoozer.uk",inline:true},{name:"Help Centre",value:"https://help.snoozer.uk",inline:true},{name:"Service status",value:"https://status.snoozer.uk",inline:true}]},[row(link("https://snoozer.uk","Open Snoozer","🌐"),link("https://help.snoozer.uk","Help Centre","📚")),row(btn("member:profile","My profile",1,"👤"),btn("ticket:start","Get support",2,"🎫"))]],
      ["member_hub","member_hub",{title:"Snoozer Member Hub",description:"Connect your account and manage community membership. Premium is verified against Snoozer's entitlement records.",color:0x8b72d9,fields:[{name:"Account",value:"Link your identity through Snoozer OAuth."},{name:"Membership",value:"View your verified Premium status."},{name:"Community",value:"Manage optional notification roles and creator verification."}]},[row(link("https://snoozer.uk/studio/discord","Link account","🔗"),btn("member:profile","My profile",2,"👤"),btn("member:premium","Premium",2,"💎")),row(btn("member:roles","Manage roles",2,"🎭"),btn("member:creator","Creator verification",2,"✨"),btn("member:cases","My cases",2,"⚖️"))]],
      ["ticket_panel","ticket_panel",{title:"Snoozer Support Desk",description:"Choose the support category. A private ticket will be created for you.\n\nNever share passwords, authentication codes or payment card details.",color:0x438f9b},[row(btn("ticket:start","Open a ticket",1,"🎫"),link("https://help.snoozer.uk","Help Centre","📚"))]],
      ["bot_control","bot_control",{title:"Snoozer Administration",description:"Private staff control panel. Every action is permission-checked and recorded.",color:0x596579,fields:[{name:"Support",value:"View and manage tickets.",inline:true},{name:"Moderation",value:"Review cases and take staff actions.",inline:true},{name:"Server",value:"Refresh panels or run the approved server rebuild.",inline:true}]},[row(btn("admin:tickets","Ticket queue",2,"🎫"),btn("admin:moderation","Moderation",2,"🛡️"),btn("admin:refresh","Refresh panels",2,"🔄")),row(btn("admin:rebuild:start","Rebuild server",4,"⚠️"))]],
      ["suggestions","suggestions",{title:"Have an idea for Snoozer?",description:"Submit a feature suggestion and let the community vote.",color:0x43a982},[row(btn("suggestion:open","Submit suggestion",1,"💡"))]],
      ["bug_reports","bug_reports",{title:"Report a Snoozer bug",description:"Submit reproducible steps. Do not include passwords or private account information.",color:0xd65a68},[row(btn("bug:open","Submit bug report",1,"🐛"))]],
      ["polls_votes","polls_votes",{title:"Community polls",description:"Take part in official Snoozer community polls.",color:0x4d91c9},[row(btn("poll:create","Create poll",2,"➕"),btn("poll:info","How voting works",2,"📊"))]],
    ];
    const errors=[];let posted=0;
    for(const [key,res,embed,components] of definitions)try{if(await this.upsertPanel(this.resources[res],key,embed,components))posted++;}catch(e){errors.push(key+": "+clean(e?.message,180));}
    return {posted,errors};
  }

  async ticketCategory(i){
    await this.reply(i,{content:"**What do you need help with?**",components:[row(select("ticket:category","Choose a support category",[
      {label:"Account support",value:"account",description:"Login, profile and account access"},
      {label:"Billing support",value:"billing",description:"Premium membership and billing"},
      {label:"Technical support",value:"technical",description:"Website and technical issues"},
      {label:"Bug report",value:"bug",description:"Report a reproducible defect"},
      {label:"Member report",value:"report",description:"Privately report a server member"},
      {label:"General enquiry",value:"general",description:"Other Snoozer questions"},
    ]))]},true);
  }
  async createTicket(i,category){
    const subject=clean(i.data?.components?.[0]?.components?.[0]?.value,100);
    const details=clean(i.data?.components?.[1]?.components?.[0]?.value,3000);
    const owner=uid(i),parent=this.resources.category_tickets;
    if(subject.length<4||details.length<10)throw new Error("Please provide a subject and at least 10 characters of detail.");
    if(!SF.test(owner)||!SF.test(parent??""))throw new Error("The private ticket category or member ID is unavailable.");
    const readSend=P.viewChannel|P.sendMessages|P.readMessageHistory|P.embedLinks|(1n<<15n);
    const roles=STAFF.map(k=>this.roleIds[k]).filter(Boolean);
    const overwrites=[{id:this.guildId,type:0,allow:"0",deny:P.viewChannel.toString()},
      {id:owner,type:1,allow:readSend.toString(),deny:"0"},
      ...roles.map(id=>({id,type:0,allow:(P.viewChannel|P.sendMessages|P.readMessageHistory|P.embedLinks).toString(),deny:"0"})),
      {id:this.botUserId,type:1,allow:readSend.toString(),deny:"0"}];
    const username=clean(i.member?.user?.username??i.user?.username,24).toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"")||"member";
    const channel=await this.api.request("/guilds/"+this.guildId+"/channels",{method:"POST",body:{
      name:"ticket-"+username+"-"+String(i.id).slice(-6),type:0,parent_id:parent,
      topic:"SNOOZER_TICKET:v2 owner="+owner+" status=open category="+category,permission_overwrites:overwrites,
    }});
    if(!SF.test(channel?.id??""))throw new Error("Discord did not return a ticket channel ID.");
    let record;
    try{
      record=await this.store.openTicket({guildId:this.guildId,channelId:channel.id,ownerId:owner,category,subject,details});
      if(!record?.created){await this.api.request("/channels/"+channel.id,{method:"DELETE"});await this.reply(i,{content:record?.channel_id?"You already have an active ticket: <#"+record.channel_id+">.":"You already have an active ticket."},true);return;}
      await this.api.request("/channels/"+channel.id,{method:"PATCH",body:{topic:"SNOOZER_TICKET:v2 id="+record.ticket_id+" owner="+owner+" status=open category="+category}});
    }catch(e){try{await this.api.request("/channels/"+channel.id,{method:"DELETE"});}catch{}throw e;}
    await this.api.request("/channels/"+channel.id+"/messages",{method:"POST",body:{
      content:"<@"+owner+">",
      embeds:[{title:"Support ticket opened",description:"**"+subject+"**\n\n"+details+"\n\nA Snoozer support team member will reply here.",color:0x438f9b,
        fields:[{name:"Category",value:category,inline:true},{name:"Priority",value:"Normal",inline:true}],
        footer:{text:"Ticket reference "+record.ticket_id},timestamp:new Date().toISOString()}],
      components:[row(btn("ticket:claim:"+record.ticket_id,"Claim",2,"🙋"),btn("ticket:priority:"+record.ticket_id,"Priority",2,"🚦"),btn("ticket:note:"+record.ticket_id,"Staff note",2,"📝"),btn("ticket:close:"+record.ticket_id,"Close",4,"🔒"))],
      allowed_mentions:{parse:[],users:[owner]},
    }});
    const queue=this.resources.ticket_queue;
    if(SF.test(queue??""))try{await this.api.request("/channels/"+queue+"/messages",{method:"POST",body:{
      embeds:[{title:"New support ticket",description:"**"+subject+"**\nMember: <@"+owner+">\nTicket: <#"+channel.id+">\nCategory: "+category,
        color:0x8b72d9,footer:{text:"Ticket "+record.ticket_id},timestamp:new Date().toISOString()}],allowed_mentions:{parse:[]},
    }});}catch(e){this.logger.error("[discord-panels] ticket queue notice failed",e?.message??e);}
    await this.reply(i,{content:"Your private support ticket has been created: <#"+channel.id+">."},true);
  }
  async getTicket(i,id){
    if(!UUID.test(id))throw new Error("Invalid ticket reference.");
    if(i.channel?.topic?.includes("id="+id))return {id,channel:i.channel,channelId:i.channel_id};
    const tickets=await this.store.ticketQueue(this.guildId,100);
    const ticket=Array.isArray(tickets)?tickets.find(t=>t.id===id):null;
    if(!ticket)throw new Error("Ticket could not be found.");
    return {id,ticket,channel:await this.api.request("/channels/"+ticket.channel_id),channelId:ticket.channel_id};
  }
  async closeTicket(i,id){
    const t=await this.getTicket(i,id);const actor=uid(i);
    const owner=t.channel.topic?.match(/\bowner=([1-9][0-9]{16,19})\b/)?.[1]??t.ticket?.owner_discord_id;
    if(actor!==owner&&!this.staff(i))throw new Error("Only the ticket owner or support staff can close this ticket.");
    const messages=await this.api.request("/channels/"+t.channelId+"/messages?limit=100");
    const transcript=(Array.isArray(messages)?messages:[]).reverse().map(m=>{
      let content=clean(m.content,2000);
      content=content.replace(/\b(password|passcode|one[- ]time code|2fa|api key|secret|card number)\b\s*[:=]\s*\S+/gi,"$1: [REDACTED]");
      content=content.replace(/\b(?:\d[ -]*?){13,19}\b/g,"[POSSIBLE PAYMENT NUMBER REDACTED]");
      return {id:m.id,author_id:m.author?.id??null,author:clean(m.author?.username,80),content,timestamp:m.timestamp};
    }).slice(-100);
    await this.store.ticketAction(id,actor,"transcript",{transcript});
    await this.store.ticketAction(id,actor,"close",{});
    const overwrites=(t.channel.permission_overwrites??[]).filter(x=>!(x.id===owner&&x.type===1));
    if(owner)overwrites.push({id:owner,type:1,allow:(P.viewChannel|P.readMessageHistory).toString(),deny:P.sendMessages.toString()});
    await this.api.request("/channels/"+t.channelId,{method:"PATCH",body:{
      name:("closed-"+clean(t.channel.name,90)).slice(0,100),
      topic:String(t.channel.topic??"").replace("status=open","status=closed")+" closed_at="+new Date().toISOString(),
      permission_overwrites:overwrites,
    }});
    await this.api.request("/channels/"+t.channelId+"/messages",{method:"POST",body:{
      embeds:[{title:"Ticket closed",description:"Closed by <@"+actor+">. A redacted transcript has been saved to restricted support records.",color:0x7a8493}],
      components:[row(btn("ticket:reopen:"+id,"Reopen ticket",1,"🔓"))],allowed_mentions:{parse:[]},
    }});
    await this.reply(i,{content:"Ticket closed. The restricted transcript has been saved."},true);
  }
  async ticketAction(i,id,action){
    if(action==="claim"){if(!this.staff(i))throw new Error("Only support staff can claim tickets.");await this.store.ticketAction(id,uid(i),"claim",{});return this.reply(i,{content:"Ticket claimed by <@"+uid(i)+">."},true);}
    if(action==="reopen"){if(!this.staff(i))throw new Error("Only support staff can reopen tickets.");const t=await this.getTicket(i,id);const owner=t.channel.topic?.match(/\bowner=([1-9][0-9]{16,19})\b/)?.[1];const ow=(t.channel.permission_overwrites??[]).filter(x=>!(x.id===owner&&x.type===1));if(owner)ow.push({id:owner,type:1,allow:(P.viewChannel|P.readMessageHistory|P.sendMessages| (1n<<15n)).toString(),deny:"0"});await this.store.ticketAction(id,uid(i),"reopen",{});await this.api.request("/channels/"+t.channelId,{method:"PATCH",body:{name:clean(t.channel.name,100).replace(/^closed-/,""),topic:String(t.channel.topic??"").replace("status=closed","status=open"),permission_overwrites:ow}});return this.reply(i,{content:"Ticket reopened."},true);}
    if(action==="priority"){
      if(!this.staff(i))throw new Error("Only support staff can change priority.");
      if(i.type===3){const priority=i.data?.values?.[0];if(!["low","normal","high","urgent"].includes(priority))throw new Error("Invalid priority.");await this.store.ticketAction(id,uid(i),"priority",{priority});return this.reply(i,{content:"Ticket priority set to "+priority.toUpperCase()+"."},true);}
      return this.reply(i,{content:"Choose a priority.",components:[row(select("ticket:priority:"+id,"Set priority",["low","normal","high","urgent"].map(v=>({label:v.toUpperCase(),value:v}))))]},true);
    }
    if(action==="note"){
      if(!this.staff(i))throw new Error("Only support staff can add internal notes.");
      return this.showModal(i,mkModal("ticket:note-submit:"+id,"Add staff-only note",[{id:"body",label:"Internal note",min:1,max:3000,style:2,placeholder:"Visible only to authorised staff."}]));
    }
  }
  async submitNote(i,id){
    if(!this.staff(i))throw new Error("Only support staff can add internal notes.");
    const body=clean(i.data?.components?.[0]?.components?.[0]?.value,3000);
    if(!body)throw new Error("Enter a note.");
    await this.store.ticketAction(id,uid(i),"note",{body});
    const dest=this.resources.staff_notes;
    if(SF.test(dest??""))await this.api.request("/channels/"+dest+"/messages",{method:"POST",body:{embeds:[{title:"Internal ticket note",description:"Ticket "+id+"\nAuthor: <@"+uid(i)+">\n\n"+body,color:0x596579}],allowed_mentions:{parse:[]}}});
    return this.reply(i,{content:"Internal note saved. It was not posted in the member-visible ticket."},true);
  }
  async ticketQueue(i){
    this.requireStaff(i);
    const tickets=await this.store.ticketQueue(this.guildId,25);
    if(!Array.isArray(tickets)||!tickets.length)return this.reply(i,{embeds:[{title:"Support queue",description:"No open tickets.",color:0x43a982}]},true);
    return this.reply(i,{embeds:[{title:"Open support tickets",description:tickets.map(t=>"**"+t.subject+"** · "+t.priority.toUpperCase()+"\n<@"+t.owner_discord_id+"> · <#"+t.channel_id+">\n"+t.id).join("\n\n").slice(0,3900),color:0x8b72d9}],
      components:[row(select("admin:ticket:select","Choose a ticket",tickets.map(t=>({label:clean(t.subject,90),value:t.id,description:t.priority+" · "+t.status}))))]},true);
  }
  async selectedTicket(i){
    this.requireStaff(i);const id=i.data?.values?.[0];if(!UUID.test(id??""))throw new Error("Choose a valid ticket.");
    return this.reply(i,{embeds:[{title:"Ticket controls",description:"Ticket reference "+id,color:0x8b72d9}],
      components:[row(btn("ticket:claim:"+id,"Claim",2),btn("ticket:close:"+id,"Close",4),btn("ticket:reopen:"+id,"Reopen",1))]},true);
  }
  async memberSummary(i){
    const s=await this.store.memberSummary(uid(i));
    if(!s?.linked)return this.reply(i,{content:"Your Discord identity is not linked to a Snoozer account. Use the Link account button first."},true);
    const profile=s.profile_url?"[Open profile]("+s.profile_url+")":"No public profile found.";
    return this.reply(i,{embeds:[{title:"Your Snoozer account",description:"**Display name:** "+clean(s.display_name??s.username??"Not set",80)+"\n**Profile:** "+profile,
      color:0x8b72d9,fields:[{name:"Premium",value:s.premium?"Active · "+String(s.plan).toUpperCase():"Not active",inline:true},{name:"Creator",value:s.creator?"Verified":"Not verified",inline:true}]}]},true);
  }
  async premiumSummary(i){
    const s=await this.store.memberSummary(uid(i));
    const description=!s?.linked?"Link your account to check your membership.":s.premium?"Verified "+String(s.plan).toUpperCase()+" entitlement active. Your Discord role is synchronised automatically.":"No active Snoozer Premium entitlement found.";
    return this.reply(i,{embeds:[{title:"Snoozer Premium",description,color:s?.premium?0xc69a43:0x7a8493}]},true);
  }
  async selfRoles(i){
    const values=new Set(i.data?.values??[]);
    const member=await this.api.request("/guilds/"+this.guildId+"/members/"+uid(i));
    const roles=new Set(member.roles??[]);
    for(const key of ["notify_updates","notify_events","notify_giveaways"]){const id=this.roleIds[key];if(!id)continue;if(values.has(key))roles.add(id);else roles.delete(id);}
    await this.api.request("/guilds/"+this.guildId+"/members/"+uid(i),{method:"PATCH",body:{roles:[...roles]}});
    return this.reply(i,{content:"Your notification roles have been updated."},true);
  }
  async creatorModal(i){return this.showModal(i,mkModal("creator:submit","Creator verification",[
    {id:"profile",label:"Snoozer profile URL",min:8,max:300,placeholder:"https://snoozer.uk/yourname"},
    {id:"reason",label:"Tell us about your creator work",min:15,max:1500,style:2,placeholder:"Explain what you create."},
  ]));}
  async submitCreator(i){
    const profile=clean(i.data?.components?.[0]?.components?.[0]?.value,300),reason=clean(i.data?.components?.[1]?.components?.[0]?.value,1500);
    const id=await this.store.creatorRequest(uid(i),profile,reason);
    return this.reply(i,{content:"Creator verification submitted. Reference: "+id+"."},true);
  }
  async createSubmissionModal(i,kind){
    return this.showModal(i,mkModal(kind+":submit",kind==="bug"?"Submit a bug report":"Submit a suggestion",[
      {id:"title",label:kind==="bug"?"Bug summary":"Suggestion title",min:4,max:120,placeholder:"Short title"},
      {id:"body",label:kind==="bug"?"Steps to reproduce":"Describe the idea",min:10,max:5000,style:2,placeholder:"Provide enough detail for the team."},
    ]));
  }
  async submitCommunityItem(i,kind){
    const title=clean(i.data?.components?.[0]?.components?.[0]?.value,120),body=clean(i.data?.components?.[1]?.components?.[0]?.value,5000);
    const id=await this.store.createSubmission({guildId:this.guildId,kind,authorId:uid(i),title,body});
    const channel=this.resources[kind==="bug"?"bug_reports":"suggestions"];
    if(SF.test(channel??"")){
      const message=await this.api.request("/channels/"+channel+"/messages",{method:"POST",body:{
        embeds:[{title:(kind==="bug"?"Bug report: ":"Suggestion: ")+title,description:body,color:kind==="bug"?0xd65a68:0x43a982,footer:{text:"Submission "+id}}],
        components:kind==="suggestion"?[row(btn("suggestion:vote:"+id,"Vote",1,"👍"))]:[],allowed_mentions:{parse:[]},
      }});
      if(message?.id)await this.store.setConfig(this.guildId,"submission_"+id,{message_id:message.id,channel_id:channel});
    }
    return this.reply(i,{content:"Your "+kind+" has been submitted. Reference: "+id+"."},true);
  }
  async voteSuggestion(i,id){
    if(!UUID.test(id))throw new Error("Invalid submission reference.");
    const r=await this.store.voteSubmission(id,uid(i),"up");
    return this.reply(i,{content:"Your vote has been recorded. Current votes: "+String(r?.upvotes??0)+"."},true);
  }
  async cases(i){
    const list=await this.store.caseHistory(this.guildId,uid(i),10);
    if(!Array.isArray(list)||!list.length)return this.reply(i,{content:"No Discord moderation cases found for your account."},true);
    const components=list.filter(c=>["active","appealed"].includes(c.status)).slice(0,5).map(c=>row(btn("appeal:open:"+c.id,"Appeal case #"+c.case_number,2,"⚖️")));
    return this.reply(i,{embeds:[{title:"Your moderation cases",description:list.map(c=>"**#"+c.case_number+" · "+c.action.toUpperCase()+"** · "+c.status+"\n"+clean(c.reason,160)+"\n"+c.id).join("\n\n").slice(0,3900),color:0x7a8493}],components},true);
  }
  async submitAppeal(i,id){
    const reason=clean(i.data?.components?.[0]?.components?.[0]?.value,2000);
    await this.store.createAppeal(id,uid(i),reason);
    const queue=this.resources.appeals_queue;
    if(SF.test(queue??""))await this.api.request("/channels/"+queue+"/messages",{method:"POST",body:{embeds:[{title:"New moderation appeal",description:"Member: <@"+uid(i)+">\nCase: "+id+"\n\n"+reason,color:0xd5a33c}],allowed_mentions:{parse:[]}}});
    return this.reply(i,{content:"Your appeal has been submitted for staff review."},true);
  }
  async moderationPanel(i){
    this.requireStaff(i,["admin","senior_moderator","moderator"]);
    return this.reply(i,{embeds:[{title:"Moderation controls",description:"Choose an action and select the target member. Every completed action creates a permanent moderation case.",color:0xd65a68}],
      components:[row(btn("mod:choose:warn","Warn",2),btn("mod:choose:timeout","Timeout",2),btn("mod:choose:kick","Kick",4)),row(btn("mod:choose:ban","Ban",4),btn("mod:choose:tempban","Temporary ban",4))]},true);
  }
  async modTarget(i,action){
    this.requireStaff(i,["admin","senior_moderator","moderator"]);
    if(!["warn","timeout","kick","ban","tempban"].includes(action))throw new Error("Invalid moderation action.");
    return this.reply(i,{content:"Select the member to "+action+".",components:[row({type:5,custom_id:"mod:target:"+action,placeholder:"Choose a server member",min_values:1,max_values:1})]},true);
  }
  async modModal(i,action,target){
    this.requireStaff(i,["admin","senior_moderator","moderator"]);
    if(!SF.test(target??""))throw new Error("Invalid target member.");
    const fields=[{id:"reason",label:"Reason",min:5,max:800,style:2,placeholder:"Explain why this action is being taken."}];
    if(action==="timeout"||action==="tempban")fields.push({id:"duration",label:action==="timeout"?"Duration in minutes":"Duration in hours",min:1,max:5,placeholder:"60"});
    return this.showModal(i,mkModal("mod:submit:"+action+":"+target,"Confirm moderation action",fields));
  }
  async executeMod(i,action,targetId){
    this.requireStaff(i,["admin","senior_moderator","moderator"]);
    const actor=uid(i),reason=clean(i.data?.components?.[0]?.components?.[0]?.value,800);
    if(reason.length<5||targetId===actor||targetId===this.botUserId)throw new Error("Invalid target or moderation reason.");
    const target=await this.api.request("/guilds/"+this.guildId+"/members/"+targetId);
    const [roles,bot]=await Promise.all([this.api.request("/guilds/"+this.guildId+"/roles"),this.api.request("/guilds/"+this.guildId+"/members/"+this.botUserId)]);
    const positions=new Map(roles.map(r=>[r.id,Number(r.position??0)]));
    const top=m=>Math.max(0,...(m.roles??[]).map(id=>positions.get(id)??0));
    if(top(bot)<=top(target))throw new Error("The target has a role equal to or above the bot's role.");
    const perm=action==="warn"?P.manageMessages:action==="timeout"?P.moderateMembers:action==="kick"?P.kickMembers:P.banMembers;
    if(!has(i.member?.permissions,perm))throw new Error("Your Discord permissions do not allow this action.");
    const headers={"X-Audit-Log-Reason":encodeURIComponent(reason.slice(0,400))};
    let duration=null;
    if(action==="warn"){
      try{const dm=await this.api.request("/users/@me/channels",{method:"POST",body:{recipient_id:targetId}});await this.api.request("/channels/"+dm.id+"/messages",{method:"POST",body:{content:"You have received a Snoozer server warning.\nReason: "+reason,allowed_mentions:{parse:[]}}});}catch(e){this.logger.warn("[discord-panels] warning DM not delivered",e?.message??e);}
    }else if(action==="timeout"){
      const minutes=Number(i.data?.components?.[1]?.components?.[0]?.value);
      if(!Number.isInteger(minutes)||minutes<1||minutes>40320)throw new Error("Timeout must be 1–40,320 minutes.");
      duration=minutes*60;await this.api.request("/guilds/"+this.guildId+"/members/"+targetId,{method:"PATCH",headers,body:{communication_disabled_until:new Date(Date.now()+duration*1000).toISOString()}});
    }else if(action==="kick"){
      await this.api.request("/guilds/"+this.guildId+"/members/"+targetId,{method:"DELETE",headers});
    }else{
      if(action==="tempban"){const hours=Number(i.data?.components?.[1]?.components?.[0]?.value);if(!Number.isInteger(hours)||hours<1||hours>720)throw new Error("Temporary ban must be 1–720 hours.");duration=hours*3600;}
      await this.api.request("/guilds/"+this.guildId+"/bans/"+targetId,{method:"PUT",headers,body:{delete_message_seconds:0}});
    }
    const record=await this.store.createCase({guildId:this.guildId,targetId,moderatorId:actor,action,reason,durationSeconds:duration,warningPoints:action==="warn"?1:0});
    if(action==="tempban"&&duration)await this.store.rpc("discord_bot_enqueue_job",{p_guild_id:this.guildId,p_job_type:"tempban_unban",p_dedupe_key:"tempban-unban:"+record.id,p_payload:{user_id:targetId,case_id:record.id},p_run_at:new Date(Date.now()+duration*1000).toISOString()});
    const log=this.resources.moderation_log;
    if(SF.test(log??""))await this.api.request("/channels/"+log+"/messages",{method:"POST",body:{embeds:[{title:"Moderation case #"+record.case_number,description:"Action: "+action.toUpperCase()+"\nMember: <@"+targetId+">\nModerator: <@"+actor+">\nReason: "+reason,color:0xd65a68,footer:{text:"Case ID "+record.id}}],allowed_mentions:{parse:[]}}});
    return this.reply(i,{content:"Moderation action completed. Case #"+record.case_number+" has been recorded."},true);
  }
  async createPoll(i){this.requireStaff(i,["admin","community_manager","event_host"]);return this.showModal(i,mkModal("poll:submit","Create a community poll",[
    {id:"question",label:"Question",min:5,max:120,placeholder:"What should the community decide?"},
    {id:"options",label:"Options separated by |",min:5,max:300,placeholder:"Option A | Option B | Option C"},
  ]));}
  async submitPoll(i){
    this.requireStaff(i,["admin","community_manager","event_host"]);
    const title=clean(i.data?.components?.[0]?.components?.[0]?.value,120);
    const options=clean(i.data?.components?.[1]?.components?.[0]?.value,300).split("|").map(x=>clean(x,80)).filter(Boolean).slice(0,5);
    if(options.length<2)throw new Error("A poll needs at least two options.");
    const id=await this.store.createSubmission({guildId:this.guildId,kind:"poll",authorId:uid(i),title,body:"Vote for one option.",metadata:{options}});
    const channel=this.resources.polls_votes;
    const message=await this.api.request("/channels/"+channel+"/messages",{method:"POST",body:{
      embeds:[{title:"📊 "+title,description:options.map((v,n)=>"**"+(n+1)+".** "+v).join("\n"),color:0x4d91c9,footer:{text:"Poll ID "+id}}],
      components:options.map((v,n)=>row(btn("poll:vote:"+id+":"+n,v,2))),allowed_mentions:{parse:[]},
    }});
    await this.store.setConfig(this.guildId,"poll_"+id,{message_id:message.id,channel_id:channel,options});
    return this.reply(i,{content:"Poll created in <#"+channel+">."},true);
  }
  async pollVote(i,id,index){
    const config=await this.store.getConfig(this.guildId),poll=config?.["poll_"+id];
    if(!UUID.test(id)||!Array.isArray(poll?.options))throw new Error("This poll is unavailable.");
    const choice=poll.options[Number(index)];if(typeof choice!=="string")throw new Error("Invalid poll choice.");
    await this.store.voteSubmission(id,uid(i),choice);
    return this.reply(i,{content:"Your vote for **"+choice+"** has been recorded."},true);
  }
  async roleSync(){
    const targets=await this.store.roleSyncTargets(this.guildId);if(!Array.isArray(targets))return;
    for(const target of targets){
      if(!SF.test(target.discord_user_id??""))continue;
      let member;try{member=await this.api.request("/guilds/"+this.guildId+"/members/"+target.discord_user_id);}catch(e){if(String(e?.message??"").includes("404"))continue;throw e;}
      const roles=new Set(member.roles??[]);let changed=false;
      for(const [flag,key] of [["premium","premium"],["creator","creator"]]){
        const id=this.roleIds[key];if(!id)continue;
        if(target[flag]&&!roles.has(id)){roles.add(id);changed=true;}if(!target[flag]&&roles.has(id)){roles.delete(id);changed=true;}
      }
      if(changed)await this.api.request("/guilds/"+this.guildId+"/members/"+target.discord_user_id,{method:"PATCH",body:{roles:[...roles]}});
    }
    this.lastRoleSync=Date.now();
  }
  async runJob(job){
    try{
      if(["premium_role_sync","creator_role_sync","role_reconcile"].includes(job.job_type))await this.roleSync();
      else if(job.job_type==="tempban_unban"&&SF.test(job.payload?.user_id??""))await this.api.request("/guilds/"+this.guildId+"/bans/"+job.payload.user_id,{method:"DELETE"});
      else if(job.job_type==="announcement"){
        const channel=this.resources[job.payload?.channel_key];if(SF.test(channel??""))await this.api.request("/channels/"+channel+"/messages",{method:"POST",body:{embeds:[{title:clean(job.payload?.title,180),description:clean(job.payload?.body,3500),color:0x35a79b}],allowed_mentions:{parse:[]}}});
      }else if(job.job_type==="ticket_reminder"&&SF.test(job.payload?.channel_id??""))await this.api.request("/channels/"+job.payload.channel_id+"/messages",{method:"POST",body:{content:"This support ticket is waiting for an update. Please reply when you can.",allowed_mentions:{parse:[]}}});
      else if(job.job_type==="scheduled_event"||job.job_type==="giveaway_finish"||job.job_type==="backup"||job.job_type==="health_check")throw new Error("This scheduled job type is registered but its execution module is not yet enabled.");
      await this.store.finishJob(job.id,true,null);
    }catch(e){this.logger.error("[discord-panels] job failed",job.job_type,e?.message??e);await this.store.finishJob(job.id,false,String(e?.message??e));}
  }
  async tick(){
    if(this.busy)return;this.busy=true;
    try{
      if(Date.now()-this.lastRoleSync>300000)try{await this.roleSync();}catch(e){this.logger.error("[discord-panels] role sync failed",e?.message??e);}
      const jobs=await this.store.claimJobs(this.guildId,20);if(Array.isArray(jobs))for(const job of jobs)await this.runJob(job);
    }catch(e){this.logger.error("[discord-panels] automation tick failed",e?.message??e);}finally{this.busy=false;}
  }
  start(){if(this.timer)return;this.timer=setInterval(()=>void this.tick(),30000);this.timer.unref?.();void this.tick();}
  stop(){if(this.timer)clearInterval(this.timer);this.timer=null;}

  async handleSlash(i){
    if(i.data?.name!==SNOOZER_REBUILD_COMMAND.name)return false;
    if(!has(i.member?.permissions,P.administrator)){await this.reply(i,{content:"Only a server Administrator can rebuild the Snoozer server."},true);return true;}
    if(opt(i,"confirmation")!=="REBUILD SNOOZER SERVER"){await this.reply(i,{content:"No changes were made. The confirmation did not match."},true);return true;}
    await this.defer(i);
    try{const result=await this.rebuilder.rebuild(uid(i));await this.refreshResources();await this.complete(i,{content:[
      result.complete?"Snoozer server rebuild completed.":"Server rebuild has outstanding failures.",
      "New categories: "+result.categoryCount+" · channels: "+result.channelCount+" · roles: "+result.roleCount,
      "Members checked: "+result.memberCount+" · role assignments migrated: "+result.memberRolesMigrated,
      "Old channels deleted: "+result.channelsDeleted+" · old roles deleted: "+result.rolesDeleted,
      "Premium/Creator role checks: "+result.roleSync.updated+" updated of "+result.roleSync.checked,
      "Configuration backup: "+result.backupId,
    ].join("\n")});}catch(e){this.logger.error("[discord-panels] server rebuild failed",e?.message??e);await this.complete(i,{content:"Server rebuild did not complete: "+clean(e?.message,700)});}
    return true;
  }

  async handle(i){
    if(i.guild_id!==this.guildId||i.application_id!==this.applicationId)return false;
    if(i.type===2)return this.handleSlash(i);
    if(i.type!==3&&i.type!==5)return false;
    const id=i.data?.custom_id;if(typeof id!=="string")return false;
    if(!await this.store.recordInteraction(i.id,id))return true;
    try{
      if(id==="ticket:start")await this.ticketCategory(i);
      else if(id==="ticket:category"){
        const cat=i.data?.values?.[0];if(!["account","billing","technical","bug","report","general"].includes(cat))throw new Error("Invalid support category.");
        await this.showModal(i,mkModal("ticket:submit:"+cat,"Open a support ticket",[
          {id:"subject",label:"Subject",min:4,max:100,placeholder:"What do you need help with?"},
          {id:"details",label:"Details",min:10,max:3000,style:2,placeholder:"Explain the issue. Do not include credentials or payment details."},
        ]));
      }else if(id.startsWith("ticket:submit:"))await this.createTicket(i,id.split(":")[2]);
      else if(id.startsWith("ticket:claim:")){if(!this.staff(i))throw new Error("Support staff only.");await this.store.ticketAction(id.split(":")[2],uid(i),"claim",{});await this.reply(i,{content:"Ticket claimed."},true);}
      else if(id.startsWith("ticket:close:"))await this.closeTicket(i,id.split(":")[2]);
      else if(id.startsWith("ticket:reopen:"))await this.ticketAction(i,id.split(":")[2],"reopen");
      else if(id.startsWith("ticket:priority:"))await this.ticketAction(i,id.split(":")[2],"priority");
      else if(id.startsWith("ticket:note:"))await this.ticketAction(i,id.split(":")[2],"note");
      else if(id.startsWith("ticket:note-submit:")){
        const tid=id.split(":")[2];this.requireStaff(i);const body=clean(i.data?.components?.[0]?.components?.[0]?.value,3000);
        if(!body)throw new Error("Enter a note.");await this.store.ticketAction(tid,uid(i),"note",{body});
        const channel=this.resources.staff_notes;if(SF.test(channel??""))await this.api.request("/channels/"+channel+"/messages",{method:"POST",body:{embeds:[{title:"Internal ticket note",description:"Ticket "+tid+"\nBy <@"+uid(i)+">\n\n"+body,color:0x596579}],allowed_mentions:{parse:[]}}});
        await this.reply(i,{content:"Internal note saved."},true);
      }else if(id==="admin:tickets"){
        this.requireStaff(i);const tickets=await this.store.ticketQueue(this.guildId,25);
        if(!Array.isArray(tickets)||!tickets.length)await this.reply(i,{embeds:[{title:"Support queue",description:"No open tickets.",color:0x43a982}]},true);
        else await this.reply(i,{embeds:[{title:"Open tickets",description:tickets.map(t=>"**"+t.subject+"** · "+t.priority+"\n<@"+t.owner_discord_id+"> · <#"+t.channel_id+">\n"+t.id).join("\n\n").slice(0,3900)}],components:[row(select("admin:ticket:select","Choose a ticket",tickets.map(t=>({label:clean(t.subject,90),value:t.id,description:t.priority+" · "+t.status}))))]},true);
      }else if(id==="admin:ticket:select"){
        this.requireStaff(i);const tid=i.data?.values?.[0];if(!UUID.test(tid??""))throw new Error("Invalid ticket.");
        await this.reply(i,{embeds:[{title:"Ticket controls",description:tid}],components:[row(btn("ticket:claim:"+tid,"Claim",2),btn("ticket:close:"+tid,"Close",4),btn("ticket:reopen:"+tid,"Reopen",1))]},true);
      }else if(id==="member:profile")await this.memberSummary(i);
      else if(id==="member:premium")await this.premiumSummary(i);
      else if(id==="member:roles")await this.reply(i,{content:"Choose your optional notification roles.",components:[row(select("member:roles:save","Optional roles",[
        {label:"Snoozer updates",value:"notify_updates"},{label:"Community events",value:"notify_events"},{label:"Giveaways",value:"notify_giveaways"},
      ],0,3))]},true);
      else if(id==="member:roles:save"){
        const chosen=new Set(i.data?.values??[]);const m=await this.api.request("/guilds/"+this.guildId+"/members/"+uid(i));const roles=new Set(m.roles??[]);
        for(const key of ["notify_updates","notify_events","notify_giveaways"]){const rid=this.roleIds[key];if(!rid)continue;if(chosen.has(key))roles.add(rid);else roles.delete(rid);}
        await this.api.request("/guilds/"+this.guildId+"/members/"+uid(i),{method:"PATCH",body:{roles:[...roles]}});
        await this.reply(i,{content:"Your optional notification roles have been updated."},true);
      }else if(id==="member:creator")await this.showModal(i,mkModal("creator:submit","Creator verification",[
        {id:"profile",label:"Snoozer profile URL",min:8,max:300,placeholder:"https://snoozer.uk/yourname"},
        {id:"reason",label:"Tell us about your creator work",min:15,max:1500,style:2,placeholder:"What do you create?"},
      ]));
      else if(id==="creator:submit"){
        const profile=clean(i.data?.components?.[0]?.components?.[0]?.value,300),reason=clean(i.data?.components?.[1]?.components?.[0]?.value,1500);
        const ref=await this.store.creatorRequest(uid(i),profile,reason);await this.reply(i,{content:"Creator verification request submitted. Reference: "+ref+"."},true);
      }else if(id==="member:cases"){
        const list=await this.store.caseHistory(this.guildId,uid(i),10);
        if(!Array.isArray(list)||!list.length)await this.reply(i,{content:"No moderation cases found."},true);
        else await this.reply(i,{embeds:[{title:"Your moderation cases",description:list.map(c=>"**#"+c.case_number+" · "+c.action+"** · "+c.status+"\n"+clean(c.reason,160)+"\n"+c.id).join("\n\n").slice(0,3900)}],
          components:list.filter(c=>["active","appealed"].includes(c.status)).slice(0,5).map(c=>row(btn("appeal:open:"+c.id,"Appeal #"+c.case_number,2,"⚖️")))},true);
      }else if(id.startsWith("appeal:open:")){
        const caseId=id.split(":")[2];if(!UUID.test(caseId))throw new Error("Invalid case.");
        await this.showModal(i,mkModal("appeal:submit:"+caseId,"Appeal moderation case",[{id:"reason",label:"Why should this case be reviewed?",min:15,max:2000,style:2,placeholder:"Explain your appeal."}]));
      }else if(id.startsWith("appeal:submit:")){
        const caseId=id.split(":")[2],reason=clean(i.data?.components?.[0]?.components?.[0]?.value,2000);
        await this.store.createAppeal(caseId,uid(i),reason);const ch=this.resources.appeals_queue;
        if(SF.test(ch??""))await this.api.request("/channels/"+ch+"/messages",{method:"POST",body:{embeds:[{title:"New moderation appeal",description:"Member: <@"+uid(i)+">\nCase: "+caseId+"\n\n"+reason,color:0xd5a33c}],allowed_mentions:{parse:[]}}});
        await this.reply(i,{content:"Your appeal has been submitted."},true);
      }else if(id==="admin:moderation"){
        this.requireStaff(i,["admin","senior_moderator","moderator"]);
        await this.reply(i,{embeds:[{title:"Moderation controls",description:"Choose an action and select a member. Every completed action is recorded as a case.",color:0xd65a68}],
          components:[row(btn("mod:choose:warn","Warn"),btn("mod:choose:timeout","Timeout"),btn("mod:choose:kick","Kick",4)),row(btn("mod:choose:ban","Ban",4),btn("mod:choose:tempban","Temporary ban",4))]},true);
      }else if(id.startsWith("mod:choose:")){
        this.requireStaff(i,["admin","senior_moderator","moderator"]);const action=id.split(":")[2];
        await this.reply(i,{content:"Select the member to "+action+".",components:[row({type:5,custom_id:"mod:target:"+action,placeholder:"Choose a server member",min_values:1,max_values:1})]},true);
      }else if(id.startsWith("mod:target:")){
        this.requireStaff(i,["admin","senior_moderator","moderator"]);const action=id.split(":")[2],target=i.data?.values?.[0];
        if(!SF.test(target??""))throw new Error("Select a valid member.");
        const fields=[{id:"reason",label:"Reason",min:5,max:800,style:2,placeholder:"Explain the action."}];
        if(action==="timeout"||action==="tempban")fields.push({id:"duration",label:action==="timeout"?"Duration in minutes":"Duration in hours",min:1,max:5,placeholder:"60"});
        await this.showModal(i,mkModal("mod:submit:"+action+":"+target,"Confirm moderation action",fields));
      }else if(id.startsWith("mod:submit:")){
        const [, , action,target]=id.split(":");this.requireStaff(i,["admin","senior_moderator","moderator"]);
        const reason=clean(i.data?.components?.[0]?.components?.[0]?.value,800),actor=uid(i);
        if(reason.length<5||target===actor||target===this.botUserId)throw new Error("Invalid target or reason.");
        const member=await this.api.request("/guilds/"+this.guildId+"/members/"+target);
        const [roles,bot]=await Promise.all([this.api.request("/guilds/"+this.guildId+"/roles"),this.api.request("/guilds/"+this.guildId+"/members/"+this.botUserId)]);
        const pos=new Map(roles.map(r=>[r.id,Number(r.position??0)])),top=m=>Math.max(0,...(m.roles??[]).map(x=>pos.get(x)??0));
        if(top(bot)<=top(member))throw new Error("The target's highest role is equal to or above the bot's role.");
        const perm=action==="warn"?P.manageMessages:action==="timeout"?P.moderateMembers:action==="kick"?P.kickMembers:P.banMembers;
        if(!has(i.member?.permissions,perm))throw new Error("Your Discord permissions do not allow this action.");
        const headers={"X-Audit-Log-Reason":encodeURIComponent(reason.slice(0,400))};let seconds=null;
        if(action==="warn"){
          try{const dm=await this.api.request("/users/@me/channels",{method:"POST",body:{recipient_id:target}});await this.api.request("/channels/"+dm.id+"/messages",{method:"POST",body:{content:"You have received a Snoozer server warning.\nReason: "+reason,allowed_mentions:{parse:[]}}});}catch(e){this.logger.warn("[discord-panels] warning DM unavailable",e?.message??e);}
        }else if(action==="timeout"){
          const minutes=Number(i.data?.components?.[1]?.components?.[0]?.value);if(!Number.isInteger(minutes)||minutes<1||minutes>40320)throw new Error("Timeout must be 1–40,320 minutes.");
          seconds=minutes*60;await this.api.request("/guilds/"+this.guildId+"/members/"+target,{method:"PATCH",headers,body:{communication_disabled_until:new Date(Date.now()+seconds*1000).toISOString()}});
        }else if(action==="kick")await this.api.request("/guilds/"+this.guildId+"/members/"+target,{method:"DELETE",headers});
        else{
          if(action==="tempban"){const hours=Number(i.data?.components?.[1]?.components?.[0]?.value);if(!Number.isInteger(hours)||hours<1||hours>720)throw new Error("Temporary ban must be 1–720 hours.");seconds=hours*3600;}
          await this.api.request("/guilds/"+this.guildId+"/bans/"+target,{method:"PUT",headers,body:{delete_message_seconds:0}});
        }
        const record=await this.store.createCase({guildId:this.guildId,targetId:target,moderatorId:actor,action,reason,durationSeconds:seconds,warningPoints:action==="warn"?1:0});
        if(action==="tempban"&&seconds)await this.store.rpc("discord_bot_enqueue_job",{p_guild_id:this.guildId,p_job_type:"tempban_unban",p_dedupe_key:"tempban-unban:"+record.id,p_payload:{user_id:target,case_id:record.id},p_run_at:new Date(Date.now()+seconds*1000).toISOString()});
        const log=this.resources.moderation_log;if(SF.test(log??""))await this.api.request("/channels/"+log+"/messages",{method:"POST",body:{embeds:[{title:"Moderation case #"+record.case_number,description:"Action: "+action.toUpperCase()+"\nMember: <@"+target+">\nModerator: <@"+actor+">\nReason: "+reason,color:0xd65a68,footer:{text:"Case "+record.id}}],allowed_mentions:{parse:[]}}});
        await this.reply(i,{content:"Moderation action completed. Case #"+record.case_number+" has been recorded."},true);
      }else if(id==="suggestion:open"||id==="bug:open"){
        const kind=id==="bug:open"?"bug":"suggestion";
        await this.showModal(i,mkModal(kind+":submit",kind==="bug"?"Submit a bug report":"Submit a suggestion",[
          {id:"title",label:kind==="bug"?"Bug summary":"Suggestion title",min:4,max:120,placeholder:"Short title"},
          {id:"body",label:kind==="bug"?"Steps to reproduce":"Describe the idea",min:10,max:5000,style:2,placeholder:"Provide enough detail for the Snoozer team."},
        ]));
      }else if(id==="suggestion:submit"||id==="bug:submit"){
        const kind=id==="bug:submit"?"bug":"suggestion";
        const title=clean(i.data?.components?.[0]?.components?.[0]?.value,120),body=clean(i.data?.components?.[1]?.components?.[0]?.value,5000);
        const ref=await this.store.createSubmission({guildId:this.guildId,kind,authorId:uid(i),title,body});
        const channel=this.resources[kind==="bug"?"bug_reports":"suggestions"];
        if(SF.test(channel??"")){
          const msg=await this.api.request("/channels/"+channel+"/messages",{method:"POST",body:{
            embeds:[{title:(kind==="bug"?"Bug report: ":"Suggestion: ")+title,description:body,color:kind==="bug"?0xd65a68:0x43a982,footer:{text:"Submission "+ref}}],
            components:kind==="suggestion"?[row(btn("suggestion:vote:"+ref,"Vote",1,"👍"))]:[],allowed_mentions:{parse:[]},
          }});
          if(msg?.id)await this.store.setConfig(this.guildId,"submission_"+ref,{message_id:msg.id,channel_id:channel});
        }
        await this.reply(i,{content:"Your "+kind+" has been submitted. Reference: "+ref+"."},true);
      }else if(id.startsWith("suggestion:vote:")){
        const ref=id.split(":")[2];if(!UUID.test(ref))throw new Error("Invalid suggestion reference.");
        const result=await this.store.voteSubmission(ref,uid(i),"up");await this.reply(i,{content:"Vote recorded. Total upvotes: "+String(result?.upvotes??0)+"."},true);
      }else if(id==="poll:create"){
        this.requireStaff(i,["admin","community_manager","event_host"]);
        await this.showModal(i,mkModal("poll:submit","Create community poll",[
          {id:"question",label:"Question",min:5,max:120,placeholder:"What should the community decide?"},
          {id:"options",label:"Options separated by |",min:5,max:300,placeholder:"Option A | Option B | Option C"},
        ]));
      }else if(id==="poll:submit"){
        this.requireStaff(i,["admin","community_manager","event_host"]);
        const title=clean(i.data?.components?.[0]?.components?.[0]?.value,120);
        const options=clean(i.data?.components?.[1]?.components?.[0]?.value,300).split("|").map(x=>clean(x,80)).filter(Boolean).slice(0,5);
        if(options.length<2)throw new Error("A poll needs at least two options.");
        const ref=await this.store.createSubmission({guildId:this.guildId,kind:"poll",authorId:uid(i),title,body:"Choose one option.",metadata:{options}});
        const channel=this.resources.polls_votes;
        const msg=await this.api.request("/channels/"+channel+"/messages",{method:"POST",body:{embeds:[{title:"📊 "+title,description:options.map((v,n)=>(n+1)+". "+v).join("\n"),color:0x4d91c9,footer:{text:"Poll "+ref}}],components:options.map((v,n)=>row(btn("poll:vote:"+ref+":"+n,v,2))),allowed_mentions:{parse:[]}}});
        await this.store.setConfig(this.guildId,"poll_"+ref,{message_id:msg.id,channel_id:channel,options});
        await this.reply(i,{content:"Poll created in <#"+channel+">."},true);
      }else if(id.startsWith("poll:vote:")){
        const [, ,ref,index]=id.split(":"),config=await this.store.getConfig(this.guildId),poll=config?.["poll_"+ref];
        if(!UUID.test(ref??"")||!Array.isArray(poll?.options)||typeof poll.options[Number(index)]!=="string")throw new Error("Poll unavailable.");
        await this.store.voteSubmission(ref,uid(i),poll.options[Number(index)]);
        await this.reply(i,{content:"Your vote for **"+poll.options[Number(index)]+"** has been recorded."},true);
      }else if(id==="poll:info")await this.reply(i,{content:"Select an option button on an active poll to submit your vote. Your latest vote is stored for that poll."},true);
      else if(id==="admin:refresh"){
        this.requireStaff(i,["admin","developer"]);await this.defer(i);const r=await this.publishPermanentPanels();
        await this.complete(i,{content:"Panels refreshed: "+r.posted+". Errors: "+(r.errors.length?r.errors.join("; "):"none")});
      }else if(id==="admin:rebuild:start"){
        this.requireStaff(i,["admin"]);await this.showModal(i,mkModal("admin:rebuild:confirm","Confirm complete server reset",[
          {id:"phrase",label:"Type REBUILD SNOOZER SERVER",min:21,max:21,placeholder:"REBUILD SNOOZER SERVER"},
        ]));
      }else if(id==="admin:rebuild:confirm"){
        this.requireStaff(i,["admin"]);const phrase=clean(i.data?.components?.[0]?.components?.[0]?.value,40);
        if(phrase!=="REBUILD SNOOZER SERVER")throw new Error("Confirmation did not match. No changes were made.");
        await this.defer(i);const r=await this.rebuilder.rebuild(uid(i));await this.refreshResources();
        await this.complete(i,{content:r.complete?"The Snoozer server rebuild completed.":"The rebuild has outstanding errors. Check #bot-logs."});
      }else{
        return false;
      }
      return true;
    }catch(e){
      this.logger.error("[discord-panels] interaction failed",id,e?.message??e);
      try{await this.reply(i,{content:"This action could not be completed: "+clean(e?.message??"Unknown error",800)},true);}catch(replyError){this.logger.error("[discord-panels] error reply failed",replyError?.message??replyError);}
      return true;
    }
  }
}
