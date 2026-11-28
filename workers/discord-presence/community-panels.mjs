import { DiscordServerRebuilder } from "./server-rebuilder.mjs";

const P={administrator:1n<<3n,manageChannels:1n<<4n,manageMessages:1n<<13n,embedLinks:1n<<14n,readMessageHistory:1n<<16n,manageGuild:1n<<5n,manageEvents:1n<<33n,kickMembers:1n<<1n,banMembers:1n<<2n,moderateMembers:1n<<40n};
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


export const SNOOZER_MEMBER_COMMANDS=[
  {name:"snoozer-profile",description:"Show your linked public Snoozer profile.",type:1},
  {name:"snoozer-account",description:"Show your linked Snoozer account and membership.",type:1},
  {name:"snoozer-leaderboard",description:"Show the community activity leaderboard.",type:1},
];
export const SNOOZER_ADMIN_COMMANDS=[
  {name:"snoozer-settings",description:"Open the Snoozer Discord administration controls.",type:1,default_member_permissions:String(1n<<5n)},
  {name:"snoozer-automod-setup",description:"Install the official Snoozer Discord AutoMod rules.",type:1,default_member_permissions:String(1n<<5n)},
  {name:"snoozer-announce",description:"Post or schedule an official Snoozer announcement.",type:1,default_member_permissions:String(1n<<5n),options:[
    {type:3,name:"channel_key",description:"Where the announcement should appear.",required:true,choices:[
      {name:"Announcements",value:"announcements"},{name:"Changelog",value:"changelog"},
      {name:"Maintenance log",value:"maintenance_log"},{name:"Service status",value:"service_status"},
    ]},
    {type:3,name:"title",description:"Announcement title.",required:true,min_length:4,max_length:180},
    {type:3,name:"message",description:"Announcement message.",required:true,min_length:10,max_length:2000},
    {type:3,name:"schedule_at",description:"Optional future ISO-8601 UTC time.",required:false,min_length:20,max_length:30},
  ]},
  {name:"snoozer-health",description:"Check the Discord bot and persistent storage health.",type:1,default_member_permissions:String(1n<<5n)},
  {name:"snoozer-backup",description:"Create an immediate backup of the Snoozer Discord server layout.",type:1,default_member_permissions:String(1n<<5n)},
  {name:"snoozer-reconcile",description:"Repair missing Snoozer server roles, channels and permissions without deleting the current layout.",type:1,default_member_permissions:String(1n<<5n),
    options:[{type:3,name:"confirmation",description:"Type RECONCILE SNOOZER SERVER to confirm.",required:true,min_length:24,max_length:24}]},
];
export const SNOOZER_RESTORE_COMMAND={
  name:"snoozer-restore-server",description:"Restore missing roles and channels from the latest backup.",
  type:1,default_member_permissions:String(1n<<5n),
  options:[{type:3,name:"confirmation",description:"Type RESTORE LATEST SNOOZER BACKUP to confirm.",required:true,min_length:29,max_length:29}],
};

export const SNOOZER_REBUILD_COMMAND={
  name:"snoozer-rebuild-server",description:"Replace the current server layout with the approved Snoozer design.",
  type:1,default_member_permissions:String(1n<<5n),
  options:[{type:3,name:"confirmation",description:"Type REBUILD SNOOZER SERVER to confirm.",required:true,min_length:22,max_length:22}],
};

export class DiscordCommunityPanels{
  constructor(config,deps={}){
    this.guildId=config.guildId;this.botUserId=config.botUserId;this.applicationId=config.applicationId;
    this.api=deps.api;this.store=deps.store;this.logger=deps.logger??console;
    this.resources={};this.roleIds={};this.onResourcesUpdated=deps.onResourcesUpdated??null;this.rebuilder=deps.rebuilder??new DiscordServerRebuilder(config,{
      api:this.api,store:this.store,logger:this.logger,onPanelsReady:()=>this.publishPermanentPanels(),
    });
    this.timer=null;this.busy=false;this.lastRoleSync=0;this.dailyBackupScheduled=false;
  }
  async refreshResources(){
    const [r,config]=await Promise.all([this.store.getResources(this.guildId),this.store.getConfig(this.guildId)]);
    this.resources=r.map??{};this.roleIds={};
    for(const [k,v] of Object.entries(this.resources))if(k.startsWith("role_"))this.roleIds[k.slice(5)]=v;
    for(const [key,value] of Object.entries(config??{}))if(key.startsWith("channel_override_")&&SF.test(value?.channel_id??""))this.resources[key.slice("channel_override_".length)]=value.channel_id;
    if(this.onResourcesUpdated)await this.onResourcesUpdated(this.resources,this.roleIds);
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
      ["bot_control","bot_control",{title:"Snoozer Administration",description:"Private staff controls for support, moderation, community, security and server management.",color:0x596579,fields:[{name:"Support",value:"View and manage tickets.",inline:true},{name:"Moderation",value:"Review cases and appeals.",inline:true},{name:"Security",value:"Configure AutoMod and server protection.",inline:true}]},[row(btn("admin:tickets","Ticket queue",2,"🎫"),btn("admin:moderation","Moderation",2,"🛡️"),btn("admin:refresh","Refresh panels",2,"🔄")),row(btn("admin:config","Bot settings",2,"⚙️"),btn("admin:creators","Creator reviews",2,"✨"),btn("admin:appeals","Appeals",2,"⚖️"),btn("admin:automod","Enable AutoMod",2,"🛡️"),btn("admin:giveaway","Create giveaway",2,"🎉"),btn("admin:event","Schedule event",2,"📅")),row(btn("admin:leaderboard","Activity stats",2,"📊"),btn("admin:support-stats","Support stats",2,"🎧"),btn("admin:backup","Create backup",2,"💾"),btn("admin:usage","Bot usage",2,"📈"),btn("admin:restore","Restore backup",1,"♻️"),btn("admin:reconcile","Repair layout",2,"🔧"),btn("admin:rebuild:start","Rebuild server",4,"⚠️"))]],
      ["events","events",{title:"Snoozer Community Events",description:"Find upcoming community events and join through Discord Scheduled Events.",color:0x438f9b},[row(btn("event:info","View upcoming events",2,"📅"))]],
      ["giveaways","giveaways",{title:"Snoozer Giveaways",description:"Official community giveaways are posted here. Use the entry button on an active giveaway to participate.",color:0xc69a43},[row(btn("giveaway:info","Giveaway information",2,"🎉"))]],
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
      components:[row(btn("ticket:claim:"+record.ticket_id,"Claim",2,"🙋"),btn("ticket:priority:"+record.ticket_id,"Priority",2,"🚦"),btn("ticket:assign:"+record.ticket_id,"Assign",2,"👤"),btn("ticket:escalate:"+record.ticket_id,"Escalate",2,"⬆️"),btn("ticket:note:"+record.ticket_id,"Staff note",2,"📝")),row(btn("ticket:close:"+record.ticket_id,"Close",4,"🔒"))],
      allowed_mentions:{parse:[],users:[owner]},
    }});
    await this.store.enqueueJob({
      guildId:this.guildId,jobType:"ticket_reminder",
      dedupeKey:"ticket-reminder:"+record.ticket_id+":1",
      payload:{ticket_id:record.ticket_id,channel_id:channel.id,reminder_number:1},
      runAt:new Date(Date.now()+24*60*60_000).toISOString(),
    });
    const queue=this.resources.ticket_queue;
    if(SF.test(queue??""))try{await this.api.request("/channels/"+queue+"/messages",{method:"POST",body:{
      embeds:[{title:"New support ticket",description:"**"+subject+"**\nMember: <@"+owner+">\nTicket: <#"+channel.id+">\nCategory: "+category,
        color:0x8b72d9,footer:{text:"Ticket "+record.ticket_id},timestamp:new Date().toISOString()}],allowed_mentions:{parse:[]},
    }});}catch(e){this.logger.error("[discord-panels] ticket queue notice failed",e?.message??e);}
    await this.reply(i,{content:"Your private support ticket has been created: <#"+channel.id+">."},true);
  }

  async assignTicket(i,id){
    if(!this.staff(i))throw new Error("Only support staff can assign tickets.");
    if(i.data?.component_type===5){
      const assignee=i.data?.values?.[0];
      if(!SF.test(assignee??""))throw new Error("Select a valid staff member.");
      const staffMember=await this.api.request("/guilds/"+this.guildId+"/members/"+assignee);
      const eligibleRoleIds=new Set(STAFF.map(key=>this.roleIds[key]).filter(Boolean));
      if(!staffMember?.user||!(staffMember.roles??[]).some(roleId=>eligibleRoleIds.has(roleId))){
        throw new Error("The selected member is not part of the Snoozer support team.");
      }
      await this.store.ticketAction(id,uid(i),"assign",{assigned_to:assignee});
      await this.api.request("/channels/"+i.channel_id+"/messages",{method:"POST",body:{
        content:"Ticket assigned to <@"+assignee+"> by <@"+uid(i)+">.",allowed_mentions:{parse:[],users:[assignee]},
      }});
      return this.reply(i,{content:"Ticket assigned to <@"+assignee+">."},true);
    }
    return this.reply(i,{content:"Select the staff member who should own this ticket.",
      components:[row({type:5,custom_id:"ticket:assign-target:"+id,placeholder:"Choose a support team member",min_values:1,max_values:1})]},true);
  }

  async escalateTicket(i,id){
    if(!this.staff(i))throw new Error("Only support staff can escalate tickets.");
    const ticket=await this.getTicket(i,id);
    await this.store.ticketAction(id,uid(i),"escalate",{reason:"Escalated by support staff"});
    const destination=this.resources.security_alerts??this.resources.ticket_queue;
    if(SF.test(destination??""))await this.api.request("/channels/"+destination+"/messages",{method:"POST",body:{
      embeds:[{title:"Support ticket escalated",description:"Ticket: <#"+ticket.channelId+">\nReference: "+id+"\nEscalated by: <@"+uid(i)+">",
        color:0xd5a33c,timestamp:new Date().toISOString()}],allowed_mentions:{parse:[]},
    }});
    return this.reply(i,{content:"Ticket escalated to senior support staff."},true);
  }

  async rateTicket(i,id,rating){
    if(!UUID.test(id)||!Number.isInteger(Number(rating))||Number(rating)<1||Number(rating)>5)throw new Error("Select a valid ticket rating.");
    const ticket=await this.store.getTicket(id);
    if(uid(i)!==ticket?.owner_discord_id)throw new Error("Only the member who opened the ticket can leave a satisfaction rating.");
    await this.store.ticketAction(id,uid(i),"rating",{rating:Number(rating)});
    return this.reply(i,{content:"Thank you. Your support rating has been recorded."},true);
  }

  async supportStatistics(i){
    this.requireStaff(i,["admin","senior_moderator","support_manager"]);
    const stats=await this.store.ticketStatistics(this.guildId);
    const top=Array.isArray(stats?.staff)?stats.staff.slice(0,5):[];
    const staffText=top.length?top.map((entry,index)=>
      "**"+(index+1)+".** <@"+entry.staff_discord_id+"> · "+entry.resolved+" resolved / "+entry.total+" assigned"
    ).join("\n"):"No assigned ticket history yet.";
    await this.reply(i,{embeds:[{
      title:"Snoozer support performance",color:0x438f9b,
      fields:[
        {name:"Total tickets",value:String(stats?.total??0),inline:true},
        {name:"Active",value:String(stats?.open??0),inline:true},
        {name:"Closed / resolved",value:String(stats?.closed??0),inline:true},
        {name:"Urgent open",value:String(stats?.urgent??0),inline:true},
        {name:"High priority open",value:String(stats?.high??0),inline:true},
        {name:"Satisfaction",value:stats?.ratings?.count?String(stats.ratings.average)+"/5 · "+stats.ratings.count+" rating(s)":"No ratings yet",inline:true},
        {name:"Staff workload",value:staffText,inline:false},
      ],
    }]},true);
  }

  async reviewCommunitySubmission(i,id,decision){
    this.requireStaff(i,["admin","community_manager","support_manager"]);
    if(!UUID.test(id)||!["approved","rejected"].includes(decision))throw new Error("Invalid suggestion review.");
    await this.store.reviewSubmission(id,uid(i),decision);
    const config=await this.store.getConfig(this.guildId);
    const messageRef=config?.["submission_"+id.replaceAll("-","")];
    if(SF.test(messageRef?.channel_id??"")&&SF.test(messageRef?.message_id??"")){
      try{
        const original=await this.api.request("/channels/"+messageRef.channel_id+"/messages/"+messageRef.message_id);
        const embeds=Array.isArray(original?.embeds)?original.embeds:[];
        if(embeds.length){
          const next={...embeds[0],footer:{text:"Submission "+id+" · "+decision.toUpperCase()+" by "+uid(i)}};
          await this.api.request("/channels/"+messageRef.channel_id+"/messages/"+messageRef.message_id,{method:"PATCH",body:{embeds:[next],components:[],allowed_mentions:{parse:[]}}});
        }
      }catch(error){this.logger.warn("[discord-panels] submission review message update failed",error?.message??error);}
    }
    await this.store.recordSecurityEvent({guildId:this.guildId,action:"community_submission_"+decision,actorId:uid(i),severity:"info",metadata:{submission_id:id}});
    return this.reply(i,{content:"Community submission "+decision+". The decision has been recorded."},true);
  }

  async getTicket(i,id){
    if(!UUID.test(id))throw new Error("Invalid ticket reference.");
    const ticket=await this.store.getTicket(id);
    if(!ticket||ticket.guild_id!==this.guildId)throw new Error("Ticket could not be found in this server.");
    const channelId=ticket.channel_id;
    const channel=i.channel_id===channelId&&i.channel
      ? i.channel
      : await this.api.request("/channels/"+channelId);
    return {id,ticket,channel,channelId};
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
      components:[row(btn("ticket:rate:"+id+":1","1 ★",2),btn("ticket:rate:"+id+":2","2 ★",2),btn("ticket:rate:"+id+":3","3 ★",2),btn("ticket:rate:"+id+":4","4 ★",2),btn("ticket:rate:"+id+":5","5 ★",2)),row(btn("ticket:reopen:"+id,"Reopen ticket",1,"🔓"))],allowed_mentions:{parse:[]},
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
      {id:"body",label:kind==="bug"?"Steps to reproduce":"Describe the idea",min:10,max:4000,style:2,placeholder:"Provide enough detail for the team."},
    ]));
  }
  async submitCommunityItem(i,kind){
    const title=clean(i.data?.components?.[0]?.components?.[0]?.value,120),body=clean(i.data?.components?.[1]?.components?.[0]?.value,5000);
    const id=await this.store.createSubmission({guildId:this.guildId,kind,authorId:uid(i),title,body});
    const channel=this.resources[kind==="bug"?"bug_reports":"suggestions"];
    if(SF.test(channel??"")){
      const message=await this.api.request("/channels/"+channel+"/messages",{method:"POST",body:{
        embeds:[{title:(kind==="bug"?"Bug report: ":"Suggestion: ")+title,description:body,color:kind==="bug"?0xd65a68:0x43a982,footer:{text:"Submission "+id}}],
        components:kind==="suggestion"?[row(btn("suggestion:vote:"+id,"Vote",1,"👍")),row(btn("suggestion:approve:"+id,"Approve",3,"✅"),btn("suggestion:reject:"+id,"Reject",4,"❌"))]:[],allowed_mentions:{parse:[]},
      }});
      if(message?.id)await this.store.setConfig(this.guildId,"submission_"+id.replaceAll("-",""),{message_id:message.id,channel_id:channel});
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

  async showAppealQueue(i){
    this.requireStaff(i,["admin","senior_moderator","moderator","support_manager"]);
    const appeals=await this.store.appealQueue(this.guildId,15);
    if(!Array.isArray(appeals)||!appeals.length)return this.reply(i,{content:"There are no pending moderation appeals."},true);
    const description=appeals.map(item=>
      "**Case #"+item.case_number+" · "+clean(item.action,30).toUpperCase()+"**\n"+
      "Member: <@"+item.appellant_discord_id+">\n"+
      "Case reason: "+clean(item.case_reason,220)+"\n"+
      "Appeal: "+clean(item.reason,300)+"\n"+
      "Appeal ID: "+item.id
    ).join("\n\n").slice(0,3900);
    const components=appeals.slice(0,5).map(item=>row(
      btn("appeal:accept:"+item.id,"Accept",3,"✅"),
      btn("appeal:reject:"+item.id,"Reject",4,"❌")
    ));
    await this.reply(i,{embeds:[{title:"Pending moderation appeals",description,color:0xd5a33c}],components},true);
  }

  async reviewAppeal(i,id,decision){
    this.requireStaff(i,["admin","senior_moderator","moderator","support_manager"]);
    if(!UUID.test(id)||!["accepted","rejected"].includes(decision))throw new Error("Invalid appeal review.");
    const pending=await this.store.appealQueue(this.guildId,100);
    const appeal=Array.isArray(pending)?pending.find(item=>item.id===id):null;
    if(!appeal)throw new Error("This appeal is no longer pending or does not belong to this server.");
    if(decision==="accepted"){
      if(["ban","tempban"].includes(appeal.action)){
        await this.api.request("/guilds/"+this.guildId+"/bans/"+appeal.appellant_discord_id,{method:"DELETE"});
      }else if(appeal.action==="timeout"){
        await this.api.request("/guilds/"+this.guildId+"/members/"+appeal.appellant_discord_id,{method:"PATCH",body:{communication_disabled_until:null}});
      }
    }
    const result=await this.store.reviewAppeal(id,uid(i),decision);
    await this.store.recordSecurityEvent({guildId:this.guildId,action:"moderation_appeal_"+decision,
      actorId:uid(i),targetId:result.target_discord_id,severity:"info",
      metadata:{appeal_id:id,case_id:result.case_id,case_number:result.case_number}});
    try{
      const dm=await this.api.request("/users/@me/channels",{method:"POST",body:{recipient_id:result.target_discord_id}});
      await this.api.request("/channels/"+dm.id+"/messages",{method:"POST",body:{
        content:decision==="accepted"
          ?"Your Snoozer Discord moderation appeal for case #"+result.case_number+" was accepted. The related moderation restriction has been lifted where applicable."
          :"Your Snoozer Discord moderation appeal for case #"+result.case_number+" was reviewed and rejected. The original moderation case remains active.",
        allowed_mentions:{parse:[]},
      }});
    }catch(error){this.logger.warn("[discord-panels] appeal outcome DM could not be delivered",error?.message??error);}
    await this.reply(i,{content:"Appeal "+decision+". Related case #"+result.case_number+" is now "+(decision==="accepted"?"overturned":"active")+"."},true);
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
    await this.store.setConfig(this.guildId,"poll_"+id.replaceAll("-",""),{message_id:message.id,channel_id:channel,options});
    return this.reply(i,{content:"Poll created in <#"+channel+">."},true);
  }
  async pollVote(i,id,index){
    const config=await this.store.getConfig(this.guildId),poll=config?.["poll_"+id.replaceAll("-","")];
    if(!UUID.test(id)||!Array.isArray(poll?.options))throw new Error("This poll is unavailable.");
    const choice=poll.options[Number(index)];if(typeof choice!=="string")throw new Error("Invalid poll choice.");
    await this.store.voteSubmission(id,uid(i),choice);
    return this.reply(i,{content:"Your vote for **"+choice+"** has been recorded."},true);
  }

  async ticketAction(i,id,action){
    if(action==="priority"){
      if(!this.staff(i))throw new Error("Only support staff can change ticket priority.");
      if(i.data?.component_type===3){
        const priority=i.data?.values?.[0];
        if(!["low","normal","high","urgent"].includes(priority))throw new Error("Invalid ticket priority.");
        await this.store.ticketAction(id,uid(i),"priority",{priority});
        return this.reply(i,{content:"Ticket priority updated to **"+priority.toUpperCase()+"**."},true);
      }
      return this.reply(i,{content:"Choose a priority.",components:[row(select("ticket:priority:"+id,"Set ticket priority",[
        {label:"LOW",value:"low"},{label:"NORMAL",value:"normal"},{label:"HIGH",value:"high"},{label:"URGENT",value:"urgent"},
      ]))]},true);
    }
    if(action==="note"){
      if(!this.staff(i))throw new Error("Only support staff can add internal notes.");
      return this.showModal(i,mkModal("ticket:note-submit:"+id,"Add staff-only note",[
        {id:"body",label:"Internal note",min:1,max:3000,style:2,placeholder:"Visible only to authorised staff."},
      ]));
    }
    if(action==="reopen"){
      if(!this.staff(i))throw new Error("Only support staff can reopen tickets.");
      if(!UUID.test(id))throw new Error("Invalid ticket reference.");
      const channel=await this.api.request("/channels/"+i.channel_id);
      if(typeof channel?.topic!=="string"||!channel.topic.includes("id="+id))throw new Error("This message is not inside the matching ticket.");
      const owner=channel.topic.match(/\\bowner=([1-9][0-9]{16,19})\\b/)?.[1];
      const overwrites=(channel.permission_overwrites??[]).filter(entry=>!(entry.id===owner&&entry.type===1));
      if(owner)overwrites.push({id:owner,type:1,allow:(P.viewChannel|P.readMessageHistory|P.sendMessages|(1n<<15n)).toString(),deny:"0"});
      await this.store.ticketAction(id,uid(i),"reopen",{});
      await this.api.request("/channels/"+channel.id,{method:"PATCH",body:{
        name:clean(channel.name,100).replace(/^closed-/,""),
        topic:String(channel.topic).replace("status=closed","status=open"),
        permission_overwrites:overwrites,
      }});
      return this.reply(i,{content:"Ticket reopened. The member can reply again."},true);
    }
    throw new Error("Unsupported ticket action.");
  }


  isAdmin(i){
    return has(i.member?.permissions,P.administrator)||has(i.member?.permissions,P.manageGuild)
      ||(i.member?.roles??[]).includes(this.roleIds.admin);
  }
  requireAdmin(i){if(!this.isAdmin(i))throw new Error("Only Snoozer Admins or Discord server administrators can use this control.");}

  async adminSettings(i){
    this.requireAdmin(i);
    await this.reply(i,{embeds:[{title:"Snoozer bot settings",description:"Choose a notification channel or configure community protection. All settings are saved to Supabase.",color:0x596579}],
      components:[
        row(btn("admin:channel:security_alerts","Security alerts"),btn("admin:channel:moderation_log","Moderation log"),btn("admin:channel:ticket_queue","Ticket queue")),
        row(btn("admin:channel:changelog","Changelog"),btn("admin:channel:service_status","Service status"),btn("admin:channel:events","Events"),btn("admin:channel:giveaways","Giveaways")),
        row(btn("admin:toggle:antiRaidEnabled","Toggle anti-raid"),btn("admin:toggle:antiNukeEnabled","Toggle anti-nuke"),btn("admin:thresholds","Protection thresholds"),btn("admin:automod","Configure AutoMod")),
      ]},true);
  }
  async chooseChannel(i,key){
    this.requireAdmin(i);
    if(!["security_alerts","moderation_log","ticket_queue","changelog","service_status","events","giveaways","appeals_queue"].includes(key))throw new Error("Unknown channel setting.");
    await this.reply(i,{content:"Choose the text channel for "+key.replaceAll("_"," ")+".",
      components:[row({type:8,custom_id:"admin:channel-set:"+key,placeholder:"Select a server text channel",min_values:1,max_values:1,channel_types:[0]})]},true);
  }
  async saveChannel(i,key){
    this.requireAdmin(i);
    const id=i.data?.values?.[0];
    if(!SF.test(id??""))throw new Error("Select a valid Discord channel.");
    const channel=await this.api.request("/channels/"+id);
    if(channel?.guild_id!==this.guildId||channel.type!==0)throw new Error("The selected channel must be a text channel in this server.");
    await this.store.setConfig(this.guildId,"channel_override_"+key,{channel_id:id});
    await this.refreshResources();
    await this.reply(i,{content:"The "+key.replaceAll("_"," ")+" notification channel has been updated."},true);
  }
  async toggleSecurity(i,key){
    this.requireAdmin(i);
    if(!["antiRaidEnabled","antiNukeEnabled"].includes(key))throw new Error("Unknown security setting.");
    const config=await this.store.getConfig(this.guildId),security={...(config?.security??{})};
    security[key]=security[key]===false;
    await this.store.setConfig(this.guildId,"security",security);
    await this.reply(i,{content:key.replace("Enabled","")+" is now "+(security[key]?"enabled":"disabled")+". The monitor will apply this setting on its next cycle."},true);
  }
  async openSecurityThresholds(i){
    this.requireAdmin(i);
    const config=await this.store.getConfig(this.guildId),settings=config?.security??{};
    await this.showModal(i,mkModal("admin:thresholds:save","Configure server protection",[
      {id:"raid_join_threshold",label:"Joins before raid lockdown (2–100)",min:1,max:3,placeholder:"10",value:String(settings.raidJoinThreshold??10)},
      {id:"raid_window",label:"Join burst window seconds (10–600)",min:2,max:3,placeholder:"60",value:String(settings.raidWindowSeconds??60)},
      {id:"lockdown_duration",label:"Lockdown duration seconds (30–1800)",min:2,max:4,placeholder:"300",value:String(settings.raidLockdownSeconds??300)},
      {id:"anti_nuke_actions",label:"Destructive actions before lockdown (2–10)",min:1,max:2,placeholder:"3",value:String(settings.antiNukeActions??3)},
      {id:"anti_nuke_window",label:"Anti-nuke action window seconds (10–300)",min:2,max:3,placeholder:"30",value:String(settings.antiNukeWindowSeconds??30)},
    ]));
  }
  async saveSecurityThresholds(i){
    this.requireAdmin(i);
    const fields=i.data?.components??[];
    const values={};
    for(const [index,key] of ["raidJoinThreshold","raidWindowSeconds","raidLockdownSeconds","antiNukeActions","antiNukeWindowSeconds"].entries()){
      values[key]=Number(clean(fields[index]?.components?.[0]?.value,5));
    }
    const limits={
      raidJoinThreshold:[2,100],raidWindowSeconds:[10,600],raidLockdownSeconds:[30,1800],
      antiNukeActions:[2,10],antiNukeWindowSeconds:[10,300],
    };
    for(const [key,[min,max]] of Object.entries(limits)){
      if(!Number.isInteger(values[key])||values[key]<min||values[key]>max)throw new Error(key+" must be between "+min+" and "+max+".");
    }
    const config=await this.store.getConfig(this.guildId);
    await this.store.setConfig(this.guildId,"security",{...(config?.security??{}),...values});
    await this.reply(i,{content:"Server protection thresholds saved. The security monitor will load them on its next cycle."},true);
  }

  async setupAutoMod(i){
    this.requireAdmin(i);
    const rules=await this.api.request("/guilds/"+this.guildId+"/auto-moderation/rules");
    const definitions=[
      {name:"Snoozer · Spam Protection",event_type:1,trigger_type:3,actions:[{type:1,metadata:{custom_message:"Snoozer automatically blocked this message as spam."}}],enabled:true,exempt_roles:[],exempt_channels:[]},
      {name:"Snoozer · Mention Spam",event_type:1,trigger_type:5,trigger_metadata:{mention_total_limit:5,mention_raid_protection_enabled:true},actions:[{type:1,metadata:{custom_message:"Please avoid mass mentions in the Snoozer community."}}],enabled:true,exempt_roles:[],exempt_channels:[]},
      {name:"Snoozer · Credential and Fake Reward Scams",event_type:1,trigger_type:1,
        trigger_metadata:{keyword_filter:["enter your seed phrase","share your seed phrase","discord token grabber","free nitro claim","verify wallet to receive prize","free steam gift claim"]},
        actions:[{type:1,metadata:{custom_message:"This message was blocked by Snoozer's anti-scam protection."}}],
        enabled:true,exempt_roles:[],exempt_channels:[]},
    ];
    let created=0,updated=0;
    for(const definition of definitions){
      const existing=Array.isArray(rules)?rules.find(rule=>rule.name===definition.name):null;
      if(existing?.id){await this.api.request("/guilds/"+this.guildId+"/auto-moderation/rules/"+existing.id,{method:"PATCH",body:definition});updated++;}
      else{await this.api.request("/guilds/"+this.guildId+"/auto-moderation/rules",{method:"POST",body:definition});created++;}
    }
    await this.store.recordSecurityEvent({guildId:this.guildId,action:"automod_rules_configured",actorId:uid(i),severity:"info",metadata:{created,updated}});
    await this.reply(i,{content:"Discord AutoMod is configured. Created "+created+" rules and updated "+updated+" existing rules."},true);
  }
  async creatorQueue(i){
    this.requireAdmin(i);
    const items=await this.store.creatorQueue(10);
    if(!Array.isArray(items)||!items.length)return this.reply(i,{content:"There are no pending Creator verification requests."},true);
    const description=items.map(item=>
      "**"+clean(item.profile_url,120)+"** · <@"+item.discord_user_id+">\n"+
      clean(item.reason,220)+"\nRequest: "+item.id
    ).join("\n\n").slice(0,3900);
    const rows=items.slice(0,5).map(item=>row(
      btn("creator:approve:"+item.id,"Approve",3,"✅"),
      btn("creator:reject:"+item.id,"Reject",4,"❌")
    ));
    await this.reply(i,{embeds:[{title:"Pending Creator verification",description,color:0x8b72d9}],components:rows},true);
  }

  async reviewCreator(i,id,decision){
    this.requireAdmin(i);
    if(!UUID.test(id)||!["approved","rejected"].includes(decision))throw new Error("Invalid Creator review.");
    if(!await this.store.creatorReview(id,uid(i),decision))throw new Error("This Creator request was already reviewed.");
    await this.store.recordSecurityEvent({guildId:this.guildId,action:"creator_verification_"+decision,actorId:uid(i),severity:"info",metadata:{request_id:id}});
    await this.reply(i,{content:"Creator verification "+decision+"."},true);
  }
  async openGiveaway(i){
    this.requireStaff(i,["admin","community_manager","event_host"]);
    await this.reply(i,{content:"Choose an optional role that members must have to enter. Select nothing for an open giveaway.",
      components:[row({type:6,custom_id:"giveaway:role-select",placeholder:"Optional eligibility role",min_values:0,max_values:1})]},true);
  }
  async giveawayRoleSelected(i){
    this.requireStaff(i,["admin","community_manager","event_host"]);
    const roleId=i.data?.values?.[0]??"all";
    if(roleId!=="all"&&!SF.test(roleId))throw new Error("Select a valid Discord role.");
    if(roleId!=="all"){
      const roles=await this.api.request("/guilds/"+this.guildId+"/roles");
      if(!Array.isArray(roles)||!roles.some(role=>role.id===roleId))throw new Error("The selected eligibility role no longer exists.");
    }
    await this.showModal(i,mkModal("giveaway:submit:"+roleId,"Create a community giveaway",[
      {id:"title",label:"Giveaway title",min:4,max:140,placeholder:"Snoozer Community Giveaway"},
      {id:"prize",label:"Prize",min:2,max:300,placeholder:"Describe the prize"},
      {id:"hours",label:"Duration in hours",min:1,max:3,placeholder:"24"},
      {id:"winners",label:"Number of winners",min:1,max:2,placeholder:"1"},
    ]));
  }
  async submitGiveaway(i,roleId="all"){
    this.requireStaff(i,["admin","community_manager","event_host"]);
    if(roleId!=="all"&&!SF.test(roleId))throw new Error("Invalid giveaway role requirement.");
    const title=clean(i.data?.components?.[0]?.components?.[0]?.value,140);
    const prize=clean(i.data?.components?.[1]?.components?.[0]?.value,300);
    const hours=Number(clean(i.data?.components?.[2]?.components?.[0]?.value,3));
    const winners=Number(clean(i.data?.components?.[3]?.components?.[0]?.value,2));
    if(!Number.isInteger(hours)||hours<1||hours>720||!Number.isInteger(winners)||winners<1||winners>20)throw new Error("Giveaway duration must be 1–720 hours and winners must be 1–20.");
    const channelId=this.resources.giveaways;
    if(!SF.test(channelId??""))throw new Error("The giveaways channel has not been configured.");
    const endsAt=new Date(Date.now()+hours*3600_000).toISOString();
    const minimumRoleId=roleId==="all"?null:roleId;
    const id=await this.store.createGiveaway({guildId:this.guildId,channelId,title,prize,winnerCount:winners,endsAt,minimumRoleId,actorId:uid(i)});
    await this.store.enqueueJob({guildId:this.guildId,jobType:"giveaway_finish",dedupeKey:"giveaway-finish:"+id,
      payload:{giveaway_id:id,channel_id:channelId},runAt:endsAt});
    await this.api.request("/channels/"+channelId+"/messages",{method:"POST",body:{
      embeds:[{title:"🎉 "+title,description:"**Prize:** "+prize+"\n**Winners:** "+winners+
        "\n**Eligibility:** "+(minimumRoleId?"Requires <@&"+minimumRoleId+">":"Open to all server members")+
        "\n**Ends:** <t:"+Math.floor(Date.parse(endsAt)/1000)+":R>\n\nPress Enter Giveaway to join.",
        color:0xc69a43,footer:{text:"Giveaway ID "+id}}],
      components:[row(btn("giveaway:enter:"+id+":"+(roleId==="all"?"all":roleId),"Enter giveaway",1,"🎉"))],allowed_mentions:{parse:[]},
    }});
    await this.reply(i,{content:"Giveaway created in <#"+channelId+">. Winners will be selected automatically when it ends."},true);
  }

  async enterGiveaway(i,id,roleId){
    if(!UUID.test(id))throw new Error("Invalid giveaway reference.");
    let eligible=true;
    if(roleId&&roleId!=="all"){
      if(!SF.test(roleId))throw new Error("Invalid giveaway role requirement.");
      const member=await this.api.request("/guilds/"+this.guildId+"/members/"+uid(i));
      eligible=(member.roles??[]).includes(roleId);
    }
    const result=await this.store.enterGiveaway(id,uid(i),eligible);
    await this.reply(i,{content:result?.entered?"You have entered the giveaway. Current entries: "+result.entries+".":"You were already entered. Current entries: "+result?.entries+"."},true);
  }
  async openEvent(i){
    this.requireStaff(i,["admin","community_manager","event_host"]);
    await this.showModal(i,mkModal("event:submit","Schedule a community event",[
      {id:"name",label:"Event name",min:4,max:100,placeholder:"Snoozer Community Meetup"},
      {id:"description",label:"Description",min:10,max:1000,style:2,placeholder:"What will happen at this event?"},
      {id:"starts",label:"Start time (ISO 8601 UTC)",min:20,max:30,placeholder:"2026-12-01T19:00:00Z"},
      {id:"ends",label:"End time (ISO 8601 UTC)",min:20,max:30,placeholder:"2026-12-01T20:00:00Z"},
    ]));
  }
  async submitEvent(i){
    this.requireStaff(i,["admin","community_manager","event_host"]);
    const name=clean(i.data?.components?.[0]?.components?.[0]?.value,100);
    const description=clean(i.data?.components?.[1]?.components?.[0]?.value,1000);
    const starts=Date.parse(clean(i.data?.components?.[2]?.components?.[0]?.value,30));
    const ends=Date.parse(clean(i.data?.components?.[3]?.components?.[0]?.value,30));
    if(!Number.isFinite(starts)||!Number.isFinite(ends)||starts<Date.now()+10*60_000||ends<=starts)throw new Error("Use future ISO 8601 UTC dates. Start must be at least 10 minutes away.");
    const event=await this.api.request("/guilds/"+this.guildId+"/scheduled-events",{method:"POST",body:{
      name,privacy_level:2,scheduled_start_time:new Date(starts).toISOString(),scheduled_end_time:new Date(ends).toISOString(),
      description,entity_type:3,entity_metadata:{location:"Snoozer community"},
    }});
    if(!SF.test(event?.id??""))throw new Error("Discord did not return a scheduled event ID.");
    const channelId=this.resources.events??null;
    await this.store.createScheduledEvent({guildId:this.guildId,discordEventId:event.id,channelId,actorId:uid(i),name,description,
      startsAt:new Date(starts).toISOString(),endsAt:new Date(ends).toISOString()});
    const reminderAt=new Date(Math.max(Date.now()+5000,starts-15*60_000)).toISOString();
    await this.store.enqueueJob({guildId:this.guildId,jobType:"scheduled_event",dedupeKey:"event-reminder:"+event.id,
      payload:{channel_id:channelId,event_id:event.id,name,description,starts_at:new Date(starts).toISOString()},runAt:reminderAt});
    await this.reply(i,{content:"Discord Scheduled Event created: https://discord.com/events/"+this.guildId+"/"+event.id},true);
  }
  async showLeaderboard(i){
    const rows=await this.store.activityLeaderboard(this.guildId,30,10);
    if(!Array.isArray(rows)||!rows.length)return this.reply(i,{content:"There is no recorded community activity yet."},true);
    const description=rows.map((entry,index)=>
      "**"+(index+1)+".** <@"+entry.discord_user_id+"> · "+entry.messages+
      " messages · "+entry.voice_minutes+" voice minutes · score "+entry.score
    ).join("\n");
    await this.reply(i,{embeds:[{title:"Snoozer community activity · last 30 days",description,color:0x4d91c9}]},true);
  }


  async createAnnouncement(i){
    this.requireStaff(i,["admin","community_manager"]);
    const channelKey=opt(i,"channel_key"),title=clean(opt(i,"title"),180),body=clean(opt(i,"message"),2000);
    const scheduleAt=opt(i,"schedule_at");
    if(!["announcements","changelog","maintenance_log","service_status"].includes(channelKey)||title.length<4||body.length<10)throw new Error("Complete all announcement fields with a valid channel.");
    const channelId=this.resources[channelKey];
    if(!SF.test(channelId??""))throw new Error("The selected announcement channel has not been configured.");
    if(scheduleAt){
      const runAt=Date.parse(scheduleAt);
      if(!Number.isFinite(runAt)||runAt<Date.now()+60_000||runAt>Date.now()+90*24*60*60_000)throw new Error("Scheduled announcements must be 1 minute to 90 days in the future. Use an ISO-8601 UTC timestamp.");
      const jobId=await this.store.enqueueJob({guildId:this.guildId,jobType:"announcement",
        dedupeKey:"announcement:"+i.id,payload:{channel_key:channelKey,title,body},runAt:new Date(runAt).toISOString()});
      await this.reply(i,{content:"Announcement scheduled for <t:"+Math.floor(runAt/1000)+":F>. Reference: "+jobId+"."},true);
      return;
    }
    await this.api.request("/channels/"+channelId+"/messages",{method:"POST",body:{
      embeds:[{title,description:body,color:0x8b72d9,timestamp:new Date().toISOString()}],allowed_mentions:{parse:[]},
    }});
    await this.reply(i,{content:"Announcement posted in <#"+channelId+">."},true);
  }

  async showUsageStats(i){
    this.requireAdmin(i);
    const stats=await this.store.interactionStats(30,25);
    const types=Array.isArray(stats?.types)?stats.types:[];
    const description=types.length?types.map((item,index)=>
      "**"+(index+1)+".** "+clean(item.interaction_type,80)+" · "+item.uses+" use(s) · last <t:"+Math.floor(Date.parse(item.last_used)/1000)+":R>"
    ).join("\n"):"No command or component activity has been recorded yet.";
    await this.reply(i,{embeds:[{title:"Snoozer bot usage · last 30 days",description:"**Total interactions:** "+String(stats?.total??0)+"\n\n"+description,color:0x596579}]},true);
  }

  async healthStatus(i){
    this.requireAdmin(i);
    const started=Date.now();
    const [bot,config,resources]=await Promise.all([
      this.api.request("/users/@me"),
      this.store.getConfig(this.guildId),
      this.store.getResources(this.guildId),
    ]);
    const elapsed=Date.now()-started;
    const count=Array.isArray(resources?.rows)?resources.rows.length:0;
    await this.reply(i,{embeds:[{
      title:"Snoozer Discord bot health",color:0x43a982,
      fields:[
        {name:"Discord Gateway",value:"Connected — command received",inline:true},
        {name:"Discord REST API",value:bot?.id?"Reachable":"Unknown",inline:true},
        {name:"Supabase storage",value:config?"Reachable":"Reachable · empty config",inline:true},
        {name:"Registered resources",value:String(count),inline:true},
        {name:"Response time",value:elapsed+" ms",inline:true},
        {name:"Security settings",value:config?.security?"Loaded":"Default settings",inline:true},
      ],
    }]},true);
  }

  async handleSlash(i){
    const name=i.data?.name;
    if(!await this.store.recordInteraction(i.id,"slash_"+String(name??"unknown").slice(0,70)))return true;
    if(name==="snoozer-profile"||name==="snoozer-account"){await this.memberSummary(i);return true;}
    if(name==="snoozer-leaderboard"){await this.showLeaderboard(i);return true;}
    if(name==="snoozer-settings"){await this.adminSettings(i);return true;}
    if(name==="snoozer-automod-setup"){await this.setupAutoMod(i);return true;}
    if(name==="snoozer-announce"){await this.createAnnouncement(i);return true;}
    if(name==="snoozer-health"){await this.healthStatus(i);return true;}
    if(name==="snoozer-usage"){await this.showUsageStats(i);return true;}
    if(name==="snoozer-backup"){this.requireAdmin(i);await this.defer(i);try{const result=await this.rebuilder.createBackup(uid(i));await this.complete(i,{content:"Server configuration backup saved. Roles: "+result.roleCount+" · channels: "+result.channelCount+" · reference: "+result.backupId+"."});}catch(error){await this.complete(i,{content:"Backup failed: "+clean(error?.message,700)});}return true;}
    if(name==="snoozer-reconcile"){this.requireAdmin(i);if(opt(i,"confirmation")!=="RECONCILE SNOOZER SERVER"){await this.reply(i,{content:"No changes were made. The confirmation did not match."},true);return true;}await this.defer(i);try{const result=await this.rebuilder.reconcile(uid(i));await this.refreshResources();await this.complete(i,{content:"Snoozer layout repair "+(result.complete?"completed":"finished with panel errors")+". Roles: "+result.roleCount+" · channels: "+result.channelCount+" · members migrated: "+result.memberRolesMigrated+" · backup: "+result.backupId+"."});}catch(error){await this.complete(i,{content:"Reconciliation stopped safely: "+clean(error?.message,700)});}return true;}
    if(name==="snoozer-backup"){
      this.requireAdmin(i);await this.defer(i);
      try{const result=await this.rebuilder.createBackup(uid(i));
        await this.complete(i,{content:"Server configuration backup saved. Roles: "+result.roleCount+" · channels: "+result.channelCount+" · reference: "+result.backupId+"."});
      }catch(error){await this.complete(i,{content:"Backup failed: "+clean(error?.message,700)});}
      return true;
    }
    if(name==="snoozer-reconcile"){
      this.requireAdmin(i);
      if(opt(i,"confirmation")!=="RECONCILE SNOOZER SERVER"){await this.reply(i,{content:"No changes were made. The confirmation did not match."},true);return true;}
      await this.defer(i);
      try{const result=await this.rebuilder.reconcile(uid(i));await this.refreshResources();
        await this.complete(i,{content:"Snoozer layout reconciliation "+(result.complete?"completed":"finished with panel errors")+". Roles: "+result.roleCount+" · channels: "+result.channelCount+" · members checked: "+result.memberCount+" · role assignments updated: "+result.memberRolesMigrated+" · backup: "+result.backupId+"."});
      }catch(error){await this.complete(i,{content:"Reconciliation stopped safely: "+clean(error?.message,700)});}
      return true;
    }
    if(name==="snoozer-rebuild-server"||name==="snoozer-restore-server"){
      if(!this.isAdmin(i)){await this.reply(i,{content:"Only a server Administrator or Snoozer Admin can perform this action."},true);return true;}
      const rebuild=name==="snoozer-rebuild-server";
      const phrase=rebuild?"REBUILD SNOOZER SERVER":"RESTORE LATEST SNOOZER BACKUP";
      if(opt(i,"confirmation")!==phrase){await this.reply(i,{content:"No changes were made. The confirmation text did not match."},true);return true;}
      await this.defer(i);
      try{
        if(rebuild){
          const result=await this.rebuilder.rebuild(uid(i));await this.refreshResources();
          await this.complete(i,{content:"Server rebuild "+(result.complete?"completed":"finished with outstanding failures")+". Categories: "+result.categoryCount+" · channels: "+result.channelCount+" · roles: "+result.roleCount+" · members migrated: "+result.memberRolesMigrated+" · backup: "+result.backupId});
        }else{
          const result=await this.rebuilder.restoreLatest(uid(i));
          await this.complete(i,{content:"Server recovery completed. Restored "+result.rolesRestored+" missing roles and "+result.channelsRestored+" missing channels from backup "+result.backupId+". Existing channels were not deleted or overwritten."});
        }
      }catch(error){this.logger.error("[discord-panels] server operation failed",error?.message??error);await this.complete(i,{content:"Server operation did not complete: "+clean(error?.message,700)});}
      return true;
    }
    return false;
  }

  async roleSync(){
    const targets=await this.store.roleSyncTargets(this.guildId);if(!Array.isArray(targets))return;
    for(const target of targets){
      if(!SF.test(target.discord_user_id??""))continue;
      let member;try{member=await this.api.request("/guilds/"+this.guildId+"/members/"+target.discord_user_id);}catch(e){if(String(e?.message??"").includes("404"))continue;throw e;}
      const roles=new Set(member.roles??[]);let changed=false;
      let premiumChanged=null,creatorChanged=null;
      for(const [flag,key] of [["premium","premium"],["creator","creator"]]){
        const id=this.roleIds[key];if(!id)continue;
        const currentlyAssigned=roles.has(id);
        if(target[flag]&&!currentlyAssigned){roles.add(id);changed=true;if(flag==="premium")premiumChanged=true;else creatorChanged=true;}
        if(!target[flag]&&currentlyAssigned){roles.delete(id);changed=true;if(flag==="premium")premiumChanged=false;else creatorChanged=false;}
      }
      if(changed){
        await this.api.request("/guilds/"+this.guildId+"/members/"+target.discord_user_id,{method:"PATCH",body:{roles:[...roles]}});
        try{
          if(premiumChanged!==null||creatorChanged!==null){
            const dm=await this.api.request("/users/@me/channels",{method:"POST",body:{recipient_id:target.discord_user_id}});
            const messages=[];
            if(premiumChanged===true)messages.push("Your Snoozer Premium membership is active"+(target.plan?" ("+String(target.plan).toUpperCase()+")":"")+". Your Discord Premium role has been added.");
            if(premiumChanged===false)messages.push("Your Snoozer Premium Discord role has been removed because no active eligible entitlement was found. Check your Snoozer account for the current membership status.");
            if(creatorChanged===true)messages.push("Your Snoozer Creator verification has been approved. Your Creator role has been added.");
            if(creatorChanged===false)messages.push("Your Snoozer Creator role has been removed because there is no active Creator verification.");
            if(messages.length)await this.api.request("/channels/"+dm.id+"/messages",{method:"POST",body:{content:messages.join("\n\n"),allowed_mentions:{parse:[]}}});
          }
        }catch(error){this.logger.warn("[discord-panels] membership role change DM could not be delivered",error?.message??error);}
      }
    }
    this.lastRoleSync=Date.now();
  }
  async runJob(job){
    try{
      if(["premium_role_sync","creator_role_sync","role_reconcile"].includes(job.job_type))await this.roleSync();
      else if(job.job_type==="tempban_unban"&&SF.test(job.payload?.user_id??""))await this.api.request("/guilds/"+this.guildId+"/bans/"+job.payload.user_id,{method:"DELETE"});
      else if(job.job_type==="backup"){
        const result=await this.rebuilder.createBackup(this.botUserId);
        const pruned=await this.store.pruneBackups(this.guildId,30);
        this.logger.info("[discord-panels] scheduled server backup completed",result.backupId,"old backups pruned",pruned);
      }else if(job.job_type==="health_check"){
        const [bot,resources]=await Promise.all([this.api.request("/users/@me"),this.store.getResources(this.guildId)]);
        if(!SF.test(bot?.id??""))throw new Error("Discord REST health check did not return a valid bot identity.");
        const healthChannel=this.resources.health_monitor;
        if(SF.test(healthChannel??""))await this.api.request("/channels/"+healthChannel+"/messages",{method:"POST",body:{
          embeds:[{title:"Snoozer Discord bot health check",description:"Discord REST API reachable. Supabase resource registry returned "+String(resources?.rows?.length??0)+" resources.",color:0x43a982,timestamp:new Date().toISOString()}],allowed_mentions:{parse:[]},
        }});
      }
      else if(job.job_type==="giveaway_finish"){
        const result=await this.store.finishGiveaway(job.payload?.giveaway_id);
        if(result?.status==="ended"){
          const winnerIds=Array.isArray(result.winners)?result.winners.map(item=>item.discord_user_id).filter(id=>SF.test(id)):[];
          await this.api.request("/channels/"+result.channel_id+"/messages",{method:"POST",body:{
            embeds:[{title:"Giveaway ended: "+clean(result.title,140),description:"**Prize:** "+clean(result.prize,250)+"\n"+(winnerIds.length?"**Winner(s):** "+winnerIds.map(id=>"<@"+id+">").join(", "):"No valid entries were received."),
              color:0xc69a43,footer:{text:"Giveaway "+result.id}}],
            allowed_mentions:{parse:[],users:winnerIds},
          }});
        }
      }else if(job.job_type==="scheduled_event"){
        const channel=job.payload?.channel_id,event=job.payload?.event_id;
        if(SF.test(channel??"")&&SF.test(event??""))await this.api.request("/channels/"+channel+"/messages",{method:"POST",body:{
          embeds:[{title:"Upcoming Snoozer event: "+clean(job.payload?.name,100),
            description:clean(job.payload?.description,900)+"\n\nStarts <t:"+Math.floor(Date.parse(job.payload?.starts_at)/1000)+":R> · [Open event](https://discord.com/events/"+this.guildId+"/"+event+")",
            color:0x438f9b}],
          allowed_mentions:{parse:[]},
        }});
      }else if(job.job_type==="announcement"){
        const channel=this.resources[job.payload?.channel_key];
        if(SF.test(channel??""))await this.api.request("/channels/"+channel+"/messages",{method:"POST",body:{embeds:[{title:clean(job.payload?.title,180),description:clean(job.payload?.body,3500),color:0x35a79b}],allowed_mentions:{parse:[]}}});
      }else if(job.job_type==="ticket_reminder"&&SF.test(job.payload?.channel_id??"")&&UUID.test(job.payload?.ticket_id??"")){
        const ticket=await this.store.getTicket(job.payload.ticket_id);
        if(ticket&&["open","claimed","waiting_member","waiting_staff"].includes(ticket.status)){
          await this.api.request("/channels/"+job.payload.channel_id+"/messages",{method:"POST",body:{
            content:"This support ticket is waiting for an update. Please reply when you can.",allowed_mentions:{parse:[]},
          }});
          const next=Number(job.payload.reminder_number??1)+1;
          await this.store.enqueueJob({
            guildId:this.guildId,jobType:"ticket_reminder",
            dedupeKey:"ticket-reminder:"+job.payload.ticket_id+":"+next,
            payload:{ticket_id:job.payload.ticket_id,channel_id:job.payload.channel_id,reminder_number:next},
            runAt:new Date(Date.now()+24*60*60_000).toISOString(),
          });
        }
      }
      await this.store.finishJob(job.id,true,null);
      if(job.job_type==="backup")await this.scheduleRecurringJob("backup","daily_backup",24*60*60_000);
      if(job.job_type==="health_check")await this.scheduleRecurringJob("health_check","health_check",5*60_000);
    }catch(e){this.logger.error("[discord-panels] job failed",job.job_type,e?.message??e);await this.store.finishJob(job.id,false,String(e?.message??e));}
  }
  async scheduleRecurringJob(jobType,configKey,intervalMs){
    const config=await this.store.getConfig(this.guildId);
    const current=Date.parse(config?.[configKey]?.next_at??"");
    if(Number.isFinite(current)&&current>Date.now()+30_000)return false;
    const next=new Date(Date.now()+intervalMs);
    await this.store.enqueueJob({
      guildId:this.guildId,jobType,
      dedupeKey:jobType+"-schedule:"+next.toISOString().slice(0,10)+":"+next.toISOString().slice(11,16),
      payload:{reason:"scheduled"},
      runAt:next.toISOString(),
    });
    await this.store.setConfig(this.guildId,configKey,{next_at:next.toISOString()});
    return true;
  }

  async tick(){
    if(this.busy)return;this.busy=true;
    try{
      if(Date.now()-this.lastRoleSync>300000)try{await this.roleSync();}catch(e){this.logger.error("[discord-panels] role sync failed",e?.message??e);}
      try{await this.scheduleRecurringJob("backup","daily_backup",24*60*60_000);}catch(error){this.logger.error("[discord-panels] daily backup scheduling failed",error?.message??error);}
      try{await this.scheduleRecurringJob("health_check","health_check",5*60_000);}catch(error){this.logger.error("[discord-panels] health check scheduling failed",error?.message??error);}
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
      else if(id.startsWith("ticket:assign-target:"))await this.assignTicket(i,id.split(":")[2]);
      else if(id.startsWith("ticket:assign:"))await this.assignTicket(i,id.split(":")[2]);
      else if(id.startsWith("ticket:escalate:"))await this.escalateTicket(i,id.split(":")[2]);
      else if(id.startsWith("ticket:rate:"))await this.rateTicket(i,id.split(":")[2],id.split(":")[3]);
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
          if(msg?.id)await this.store.setConfig(this.guildId,"submission_"+ref.replaceAll("-",""),{message_id:msg.id,channel_id:channel});
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
        await this.store.setConfig(this.guildId,"poll_"+ref.replaceAll("-",""),{message_id:msg.id,channel_id:channel,options});
        await this.reply(i,{content:"Poll created in <#"+channel+">."},true);
      }else if(id.startsWith("poll:vote:")){
        const [, ,ref,index]=id.split(":"),config=await this.store.getConfig(this.guildId),poll=config?.["poll_"+ref.replaceAll("-","")];
        if(!UUID.test(ref??"")||!Array.isArray(poll?.options)||typeof poll.options[Number(index)]!=="string")throw new Error("Poll unavailable.");
        await this.store.voteSubmission(ref,uid(i),poll.options[Number(index)]);
        await this.reply(i,{content:"Your vote for **"+poll.options[Number(index)]+"** has been recorded."},true);
      }else if(id==="poll:info")await this.reply(i,{content:"Select an option button on an active poll to submit your vote. Your latest vote is stored for that poll."},true);
      else if(id==="admin:refresh"){
        this.requireStaff(i,["admin","developer"]);await this.defer(i);const r=await this.publishPermanentPanels();
        await this.complete(i,{content:"Panels refreshed: "+r.posted+". Errors: "+(r.errors.length?r.errors.join("; "):"none")});
      }else if(id==="admin:rebuild:start"){
        if(!has(i.member?.permissions,P.administrator)&&!(i.member?.roles??[]).includes(this.roleIds.admin))throw new Error("Only a server Administrator or Snoozer Admin can rebuild the server.");await this.showModal(i,mkModal("admin:rebuild:confirm","Confirm complete server reset",[
          {id:"phrase",label:"Type REBUILD SNOOZER SERVER",min:22,max:22,placeholder:"REBUILD SNOOZER SERVER"},
        ]));
      }else if(id==="admin:rebuild:confirm"){
        if(!has(i.member?.permissions,P.administrator)&&!(i.member?.roles??[]).includes(this.roleIds.admin))throw new Error("Only a server Administrator or Snoozer Admin can rebuild the server.");const phrase=clean(i.data?.components?.[0]?.components?.[0]?.value,40);
        if(phrase!=="REBUILD SNOOZER SERVER")throw new Error("Confirmation did not match. No changes were made.");
        await this.defer(i);const r=await this.rebuilder.rebuild(uid(i));await this.refreshResources();
        await this.complete(i,{content:r.complete?"The Snoozer server rebuild completed.":"The rebuild has outstanding errors. Check #bot-logs."});
      }else if(id==="admin:config")await this.adminSettings(i);
      else if(id.startsWith("admin:channel:"))await this.chooseChannel(i,id.split(":")[2]);
      else if(id.startsWith("admin:channel-set:"))await this.saveChannel(i,id.split(":")[2]);
      else if(id.startsWith("admin:toggle:"))await this.toggleSecurity(i,id.split(":")[2]);
      else if(id==="admin:automod")await this.setupAutoMod(i);
      else if(id==="admin:thresholds")await this.openSecurityThresholds(i);
      else if(id==="admin:thresholds:save")await this.saveSecurityThresholds(i);
      else if(id==="admin:creators")await this.creatorQueue(i);
      else if(id.startsWith("creator:approve:"))await this.reviewCreator(i,id.split(":")[2],"approved");
      else if(id.startsWith("creator:reject:"))await this.reviewCreator(i,id.split(":")[2],"rejected");
      else if(id==="admin:giveaway")await this.openGiveaway(i);
      else if(id==="giveaway:role-select")await this.giveawayRoleSelected(i);
      else if(id.startsWith("giveaway:submit:"))await this.submitGiveaway(i,id.split(":")[2]);
      else if(id.startsWith("giveaway:enter:")){
        const parts=id.split(":");await this.enterGiveaway(i,parts[2],parts[3]??"all");
      }else if(id==="admin:event")await this.openEvent(i);
      else if(id==="event:submit")await this.submitEvent(i);
      else if(id==="admin:leaderboard"||id==="member:leaderboard")await this.showLeaderboard(i);

      else if(id==="admin:backup"){
        this.requireAdmin(i);await this.defer(i);
        const result=await this.rebuilder.createBackup(uid(i));
        await this.complete(i,{content:"Configuration backup saved. Roles: "+result.roleCount+" · channels: "+result.channelCount+" · reference: "+result.backupId+"."});
      }else if(id==="admin:reconcile"){
        this.requireAdmin(i);
        await this.showModal(i,mkModal("admin:reconcile:confirm","Confirm safe layout repair",[
          {id:"phrase",label:"Type RECONCILE SNOOZER SERVER",min:24,max:24,placeholder:"RECONCILE SNOOZER SERVER"},
        ]));
      }else if(id==="admin:reconcile:confirm"){
        this.requireAdmin(i);
        if(clean(i.data?.components?.[0]?.components?.[0]?.value,40)!=="RECONCILE SNOOZER SERVER")throw new Error("Confirmation did not match. No changes were made.");
        await this.defer(i);
        const result=await this.rebuilder.reconcile(uid(i));await this.refreshResources();
        await this.complete(i,{content:"Layout repair "+(result.complete?"completed":"finished with panel errors")+". Roles: "+result.roleCount+" · channels: "+result.channelCount+" · members migrated: "+result.memberRolesMigrated+" · backup: "+result.backupId+"."});
      }else if(id==="admin:restore"){
        this.requireAdmin(i);
        await this.showModal(i,mkModal("admin:restore:confirm","Confirm server recovery",[
          {id:"phrase",label:"Type RESTORE LATEST SNOOZER BACKUP",min:29,max:29,placeholder:"RESTORE LATEST SNOOZER BACKUP"},
        ]));
      }else if(id==="admin:restore:confirm"){
        this.requireAdmin(i);
        if(clean(i.data?.components?.[0]?.components?.[0]?.value,40)!=="RESTORE LATEST SNOOZER BACKUP")throw new Error("Confirmation did not match. No changes were made.");
        await this.defer(i);
        const result=await this.rebuilder.restoreLatest(uid(i));
        await this.complete(i,{content:"Backup recovery completed. Restored "+result.rolesRestored+" missing roles and "+result.channelsRestored+" missing channels. Existing channels were not removed or overwritten."});
      }else if(id==="giveaway:info")await this.reply(i,{content:"Official giveaways are posted in this channel. Press Enter Giveaway on an active post to join. Entries are stored persistently and winners are selected automatically when the giveaway ends."},true);
      else if(id==="event:info"){
        const events=await this.store.scheduledEventQueue(this.guildId,10);
        const description=Array.isArray(events)&&events.length?events.map(event=>
          "**"+clean(event.name,100)+"** · <t:"+Math.floor(Date.parse(event.starts_at)/1000)+":F>\n"+
          "https://discord.com/events/"+this.guildId+"/"+event.discord_event_id
        ).join("\n\n"):"There are no upcoming Snoozer events.";
        await this.reply(i,{embeds:[{title:"Upcoming Snoozer events",description,color:0x438f9b}]},true);
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
