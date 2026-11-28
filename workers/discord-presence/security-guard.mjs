const SF=/^[1-9][0-9]{16,19}$/;
const PERM={sendMessages:1n<<11n,manageChannels:1n<<4n,administrator:1n<<3n,manageGuild:1n<<5n,manageRoles:1n<<28n};
const DESTRUCTIVE_ACTIONS=new Set([12,15,22,32,52,62,73,80,82,92,102,112,142]);
const RELEVANT_ACTIONS=new Map([
  [12,"Channel deleted"],[14,"Channel overwrite changed"],[15,"Channel overwrite removed"],
  [22,"Member banned"],[30,"Role created"],[31,"Role permissions changed"],[32,"Role deleted"],
  [80,"Bot added to server"],
  [50,"Webhook created"],[51,"Webhook changed"],[52,"Webhook deleted"],
  [72,"Message deleted"],[73,"Messages bulk-deleted"],[82,"Integration deleted"],
  [102,"Scheduled event deleted"],[112,"Thread deleted"],[142,"AutoMod rule deleted"],
]);
const safe=(v,n=300)=>typeof v==="string"?v.replace(/[\u0000-\u001f\u007f]/g,"").slice(0,n):"";
const asBits=v=>{try{return BigInt(v??"0");}catch{return 0n;}};

export class DiscordSecurityGuard{
  constructor(config,deps={}){
    this.guildId=config.guildId;this.botUserId=config.botUserId;
    this.api=deps.api;this.store=deps.store;this.logger=deps.logger??console;
    this.getResources=deps.getResources??(()=>({}));
    this.getRoleIds=deps.getRoleIds??(()=>({}));
    this.ownerId=null;this.settings={raidJoinThreshold:10,raidWindowSeconds:60,raidLockdownSeconds:300,antiNukeActions:3,antiNukeWindowSeconds:30,antiRaidEnabled:true,antiNukeEnabled:true};
    this.joinTimes=[];this.actorActions=new Map();this.messageTimes=new Map();this.timer=null;this.busy=false;
  }

  async initialise(){
    const [guild,config]=await Promise.all([
      this.api.request("/guilds/"+this.guildId),
      this.store.getConfig(this.guildId),
    ]);
    this.ownerId=SF.test(guild?.owner_id??"")?guild.owner_id:null;
    const saved=config?.security;
    if(saved&&typeof saved==="object"){
      this.settings={...this.settings,...Object.fromEntries(Object.entries(saved).filter(([k,v])=>
        (["antiRaidEnabled","antiNukeEnabled"].includes(k)&&typeof v==="boolean")||(["raidJoinThreshold","raidWindowSeconds","raidLockdownSeconds","antiNukeActions","antiNukeWindowSeconds"].includes(k)&&Number.isInteger(v)&&v>0)))};
    }
    await this.restoreExpiredLockdown();
    return true;
  }

  async isTrusted(actorId){
    if(!SF.test(actorId??""))return false;
    if(actorId===this.botUserId||actorId===this.ownerId)return true;
    const roleIds=this.getRoleIds()??{};
    const trustedRoles=new Set([roleIds.admin,roleIds.developer].filter(Boolean));
    if(trustedRoles.size===0)return false;
    try{
      const member=await this.api.request("/guilds/"+this.guildId+"/members/"+actorId);
      return Array.isArray(member?.roles)&&member.roles.some(roleId=>trustedRoles.has(roleId));
    }catch(error){
      this.logger.warn("[discord-security] could not verify audit actor roles; treating actor as untrusted",error?.message??error);
      return false;
    }
  }

  async alert(title,description,severity="warning"){
    const channelId=(this.getResources()??{}).security_alerts;
    if(!SF.test(channelId??""))return false;
    try{
      await this.api.request("/channels/"+channelId+"/messages",{method:"POST",body:{
        embeds:[{title:safe(title,200),description:safe(description,3500),
          color:severity==="critical"?0xd65a68:severity==="warning"?0xd5a33c:0x438f9b,
          timestamp:new Date().toISOString(),footer:{text:"Snoozer security monitor"}}],
        allowed_mentions:{parse:[]},
      }});
      return true;
    }catch(error){
      this.logger.error("[discord-security] security alert could not be posted",error?.message??error);
      return false;
    }
  }

  async record(action,actorId,targetId,metadata={},severity="warning"){
    try{
      if(typeof this.store.recordSecurityEvent==="function"){
        await this.store.recordSecurityEvent({
          guildId:this.guildId,action,actorId:SF.test(actorId??"")?actorId:null,
          targetId:SF.test(targetId??"")?targetId:null,metadata,severity,
        });
      }
    }catch(error){this.logger.error("[discord-security] event persistence failed",error?.message??error);}
  }

  prune(values,cutoff){while(values.length&&values[0]<cutoff)values.shift();return values;}

  async handleMemberJoin(member){
    const id=member?.user?.id;
    if(this.settings.antiRaidEnabled===false||!SF.test(id??"")||member.user.bot)return;
    const now=Date.now(),windowMs=this.settings.raidWindowSeconds*1000;
    this.joinTimes.push(now);this.prune(this.joinTimes,now-windowMs);
    if(this.joinTimes.length>=this.settings.raidJoinThreshold){
      this.joinTimes=[];
      await this.record("anti_raid_join_burst",null,id,{threshold:this.settings.raidJoinThreshold,window_seconds:this.settings.raidWindowSeconds},"critical");
      await this.lockdownPublicChannels("A join burst reached "+this.settings.raidJoinThreshold+" members within "+this.settings.raidWindowSeconds+" seconds.");
    }
  }

  async handleMessage(message){
    if(!message||message.guild_id!==this.guildId||message.author?.bot||!SF.test(message.author?.id??""))return false;
    const content=safe(message.content,4000),userId=message.author.id;
    const roleIds=this.getRoleIds()??{},memberRoles=new Set(message.member?.roles??[]);
    if(["admin","senior_moderator","moderator","community_manager"].some(key=>roleIds[key]&&memberRoles.has(roleIds[key])))return false;
    const mentions=(message.mentions??[]).length,roleMentions=(message.mention_roles??[]).length;
    const links=(content.match(/https?:\/\//gi)??[]).length;
    const now=Date.now(),times=this.messageTimes.get(userId)??[];
    times.push(now);this.prune(times,now-10_000);this.messageTimes.set(userId,times);
    const suspicious=message.mention_everyone||mentions>=6||roleMentions>=4||links>=5||times.length>=8;
    if(!suspicious||(!content&&!message.mention_everyone&&!mentions&&!roleMentions))return false;
    try{await this.api.request("/channels/"+message.channel_id+"/messages/"+message.id,{method:"DELETE"});}
    catch(error){this.logger.warn("[discord-security] suspected spam message could not be deleted",error?.message??error);}
    await this.record("automod_spam",null,userId,{channel_id:message.channel_id,message_id:message.id,mentions,role_mentions:roleMentions,links,burst_count:times.length},"warning");
    await this.alert("Potential spam removed","Member <@"+userId+"> triggered the emergency spam guard.\nMentions: "+mentions+" · role mentions: "+roleMentions+" · links: "+links+" · messages in 10 seconds: "+times.length);
    return true;
  }

  async handleAuditEntry(entry){
    if(!entry||entry.guild_id!==this.guildId)return false;
    const actorId=entry.user_id,targetId=entry.target_id,action=Number(entry.action_type);
    if(!SF.test(actorId??"")||await this.isTrusted(actorId))return false;
    const label=RELEVANT_ACTIONS.get(action);
    if(!label)return false;
    const now=Date.now(),items=this.actorActions.get(actorId)??[];
    items.push({at:now,action,targetId});
    const retained=items.filter(x=>x.at>now-this.settings.antiNukeWindowSeconds*1000);
    this.actorActions.set(actorId,retained);
    const highImpact=retained.filter(x=>DESTRUCTIVE_ACTIONS.has(x.action)).length;
    await this.record("audit_"+action,actorId,targetId,{label,action_type:action,audit_entry_id:entry.id,options:entry.options??{}},highImpact>=this.settings.antiNukeActions?"critical":"warning");
    await this.alert(highImpact>=this.settings.antiNukeActions?"Possible server nuke detected":"Sensitive server action",
      "**Action:** "+label+"\n**Actor:** <@"+actorId+">\n**Target:** "+safe(targetId,30)+"\n**Recent destructive actions:** "+highImpact+" in "+this.settings.antiNukeWindowSeconds+" seconds.",
      highImpact>=this.settings.antiNukeActions?"critical":"warning");
    if(this.settings.antiNukeEnabled!==false&&highImpact>=this.settings.antiNukeActions){
      await this.lockdownPublicChannels("Possible anti-nuke response: "+highImpact+" destructive actions by "+actorId+" in "+this.settings.antiNukeWindowSeconds+" seconds.");
    }
    if(action===30||action===31){
      try{
        const roles=await this.api.request("/guilds/"+this.guildId+"/roles");
        const role=Array.isArray(roles)?roles.find(x=>x.id===targetId):null;
        const dangerous=PERM.administrator|PERM.manageGuild|PERM.manageRoles|PERM.manageChannels;
        if(role&&(asBits(role.permissions)&dangerous)!==0n){
          await this.alert("Role permission escalation","Role "+safe(role.name,80)+" now holds Administrator, Manage Server, Manage Roles or Manage Channels.\nActor: <@"+actorId+">. Review this change immediately.","critical");
        }
      }catch(error){this.logger.error("[discord-security] role escalation check failed",error?.message??error);}
    }
    if(action===50&&SF.test(targetId??"")){
      try{
        await this.api.request("/webhooks/"+targetId,{method:"DELETE"});
        await this.record("anti_webhook_removed",actorId,targetId,{audit_entry_id:entry.id},"critical");
        await this.alert("Untrusted webhook removed","A webhook created by an untrusted actor was deleted. Actor: <@"+actorId+">.","critical");
      }catch(error){
        await this.alert("Untrusted webhook detected","An untrusted actor created a webhook. Automatic removal was blocked by Discord permissions or API restrictions. Actor: <@"+actorId+"> · webhook: "+safe(targetId,40),"critical");
        this.logger.warn("[discord-security] webhook removal was not permitted",error?.message??error);
      }
    }
    if(action===80&&SF.test(targetId??"")){
      try{
        const member=await this.api.request("/guilds/"+this.guildId+"/members/"+targetId);
        if(member?.user?.bot&&targetId!==this.botUserId){
          await this.api.request("/guilds/"+this.guildId+"/members/"+targetId,{method:"DELETE",headers:{"X-Audit-Log-Reason":"Unapproved bot invite removed by Snoozer anti-raid protection."}});
          await this.record("anti_unapproved_bot_removed",actorId,targetId,{audit_entry_id:entry.id},"critical");
          await this.alert("Unapproved bot invite removed","An untrusted actor invited a bot. The bot was removed automatically. Inviting actor: <@"+actorId+">.","critical");
        }
      }catch(error){
        await this.alert("Unapproved bot invite detected","A bot was added by an untrusted actor, but automatic removal failed. Review audit logs immediately. Actor: <@"+actorId+"> · target: "+safe(targetId,40),"critical");
        this.logger.error("[discord-security] unapproved bot removal failed",error?.message??error);
      }
    }
    return true;
  }

  async handleAutoModeration(event){
    if(!event||event.guild_id!==this.guildId)return false;
    const actor=event.user_id,rule=event.rule_id;
    await this.record("native_automod_action",actor,actor,{
      rule_id:rule,action:event.action??null,channel_id:event.channel_id??null,
      message_id:event.message_id??null,matched_keyword:safe(event.matched_keyword,80),
    },"info");
    await this.alert("Discord AutoMod action","A native Discord AutoMod rule acted on "+(SF.test(actor??"")?"<@"+actor+">":"unknown")+".\nRule: "+safe(rule,40)+" · channel: "+safe(event.channel_id,40),"info");
    return true;
  }

  async lockdownPublicChannels(reason){
    const existing=await this.store.getConfig(this.guildId);
    const current=existing?.raid_lockdown;
    if(current?.active){
      await this.alert("Server lockdown remains active",reason,"critical");
      return true;
    }
    const resources=this.getResources()??{};
    const publicCategories=["start_here","updates","community","support"].map(key=>resources["category_"+key]).filter(Boolean);
    const channels=await this.api.request("/guilds/"+this.guildId+"/channels");
    const targets=(Array.isArray(channels)?channels:[]).filter(channel=>
      channel.type===0&&publicCategories.includes(channel.parent_id)&&SF.test(channel.id));
    const saved=targets.map(channel=>({channel_id:channel.id,
      overwrites:Array.isArray(channel.permission_overwrites)?channel.permission_overwrites:[]}));
    const state={active:true,reason:safe(reason,500),locked_at:new Date().toISOString(),
      expires_at:new Date(Date.now()+this.settings.raidLockdownSeconds*1000).toISOString(),channels:saved};
    // Persist the original permissions before the first Discord mutation so a partial failure
    // or worker restart can always restore the channels that were already changed.
    await this.store.setConfig(this.guildId,"raid_lockdown",state);
    const failures=[];
    for(const channel of targets){
      const overwrites=Array.isArray(channel.permission_overwrites)?channel.permission_overwrites:[];
      const everyone=overwrites.find(item=>item.id===this.guildId&&item.type===0);
      const next=overwrites.filter(item=>!(item.id===this.guildId&&item.type===0));
      const allow=asBits(everyone?.allow),deny=asBits(everyone?.deny)|PERM.sendMessages;
      next.push({id:this.guildId,type:0,allow:allow.toString(),deny:deny.toString()});
      try{await this.api.request("/channels/"+channel.id,{method:"PATCH",body:{permission_overwrites:next}});}
      catch(error){failures.push(channel.id);this.logger.error("[discord-security] lockdown failed",channel.id,error?.message??error);}
    }
    if(failures.length)await this.alert("Server lockdown partially applied","Some public channels could not be locked: "+failures.join(", ")+". The saved state will be retried by the monitor.","critical");
    else await this.alert("Temporary server lockdown enabled",reason+"\nPublic chat is temporarily read-only. It will be restored automatically after "+this.settings.raidLockdownSeconds+" seconds.","critical");
    return failures.length===0;
  }

  async restoreExpiredLockdown(){
    const config=await this.store.getConfig(this.guildId);
    const state=config?.raid_lockdown;
    if(!state?.active||!Array.isArray(state.channels)||Date.parse(state.expires_at)>Date.now())return false;
    const failures=[];
    for(const entry of state.channels){
      if(!SF.test(entry.channel_id)||!Array.isArray(entry.overwrites))continue;
      try{await this.api.request("/channels/"+entry.channel_id,{method:"PATCH",body:{permission_overwrites:entry.overwrites}});}
      catch(error){failures.push(entry.channel_id);this.logger.error("[discord-security] lockdown restore failed",entry.channel_id,error?.message??error);}
    }
    if(failures.length===0)await this.store.setConfig(this.guildId,"raid_lockdown",{active:false,restored_at:new Date().toISOString()});
    await this.alert(failures.length?"Lockdown restore needs attention":"Temporary server lockdown lifted",
      failures.length?"Could not restore permissions on "+failures.length+" channel(s). An administrator should review them.":"Public channel permissions have been restored.","info");
    return failures.length===0;
  }

  async tick(){
    if(this.busy)return;this.busy=true;
    try{
      const config=await this.store.getConfig(this.guildId);
      const saved=config?.security;
      if(saved&&typeof saved==="object")for(const key of ["antiRaidEnabled","antiNukeEnabled","raidJoinThreshold","raidWindowSeconds","raidLockdownSeconds","antiNukeActions","antiNukeWindowSeconds"]){
        if(typeof saved[key]==="boolean"||Number.isInteger(saved[key])&&saved[key]>0)this.settings[key]=saved[key];
      }
      await this.restoreExpiredLockdown();
    }catch(error){this.logger.error("[discord-security] monitor tick failed",error?.message??error);}
    finally{this.busy=false;}
  }

  start(){
    if(this.timer)return;
    this.timer=setInterval(()=>void this.tick(),30_000);this.timer.unref?.();
    void this.tick();
  }
  stop(){if(this.timer)clearInterval(this.timer);this.timer=null;}
}
