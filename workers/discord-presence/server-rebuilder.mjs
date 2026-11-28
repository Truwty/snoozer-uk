import { SNOOZER_ROLE_LAYOUT, SNOOZER_SERVER_LAYOUT, LEGACY_ROLE_NAMES } from "./server-layout.mjs";

const P = {
  administrator:1n<<3n, manageChannels:1n<<4n, manageGuild:1n<<5n, viewAuditLog:1n<<7n,
  viewChannel:1n<<10n, sendMessages:1n<<11n, manageMessages:1n<<13n, embedLinks:1n<<14n,
  attachFiles:1n<<15n, readMessageHistory:1n<<16n, connect:1n<<20n, speak:1n<<21n,
  kickMembers:1n<<1n, banMembers:1n<<2n, manageRoles:1n<<28n, manageWebhooks:1n<<29n,
  manageEvents:1n<<33n, moderateMembers:1n<<40n,
};
const bitfield = names => names.reduce((value,name)=>{
  const permission=P[name];
  if(typeof permission!=="bigint")throw new Error("Unknown Discord permission key in Snoozer role layout: "+String(name)+".");
  return value|permission;
},0n);
const validSnowflake = value => typeof value==="string" && /^[1-9][0-9]{16,19}$/.test(value);
const normaliseRole = value => String(value??"").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N} ]/gu,"").replace(/\s+/g," ").trim();

function overwrite(id,type,allow=0n,deny=0n) {
  return {id,type,allow:allow.toString(),deny:deny.toString()};
}
function allStaff(roleIds) {
  return ["admin","senior_moderator","moderator","community_manager","support_manager","support_team","ticket_support","developer"].map(key=>roleIds[key]).filter(Boolean);
}
function categoryOverwrites(guildId,botUserId,roleIds,visibility) {
  const read=P.viewChannel|P.readMessageHistory;
  const send=read|P.sendMessages|P.embedLinks|P.attachFiles;
  const bot=overwrite(botUserId,1,send);
  if(visibility==="public") return [overwrite(guildId,0,read),bot];
  if(visibility==="private") return [overwrite(guildId,0,0n,P.viewChannel),...allStaff(roleIds).map(id=>overwrite(id,0,send)),bot];
  if(visibility==="staff") return [overwrite(guildId,0,0n,P.viewChannel),...allStaff(roleIds).map(id=>overwrite(id,0,send)),bot];
  return [overwrite(guildId,0,0n,P.viewChannel),
    ...["admin","developer"].map(key=>roleIds[key]).filter(Boolean).map(id=>overwrite(id,0,read|P.sendMessages|P.embedLinks)),bot];
}
function channelOverwrites(guildId,botUserId,roleIds,category,channel) {
  const read=P.viewChannel|P.readMessageHistory;
  const send=read|P.sendMessages|P.embedLinks|P.attachFiles;
  if(channel.key==="staff_voice") return [
    overwrite(guildId,0,0n,P.viewChannel),
    ...allStaff(roleIds).map(id=>overwrite(id,0,P.viewChannel|P.connect|P.speak)),
    overwrite(botUserId,1,P.viewChannel|P.connect|P.speak),
  ];
  if(channel.mode==="readonly") return [
    overwrite(guildId,0,read,P.sendMessages),
    ...["admin","community_manager","developer"].map(key=>roleIds[key]).filter(Boolean).map(id=>overwrite(id,0,send)),
    overwrite(botUserId,1,send),
  ];
  if(channel.type==="voice") {
    if(category.visibility==="public") return [
      overwrite(guildId,0,P.viewChannel|P.connect|P.speak),
      overwrite(botUserId,1,P.viewChannel|P.connect|P.speak),
    ];
    return [
      overwrite(guildId,0,0n,P.viewChannel),
      ...allStaff(roleIds).map(id=>overwrite(id,0,P.viewChannel|P.connect|P.speak)),
      overwrite(botUserId,1,P.viewChannel|P.connect|P.speak),
    ];
  }
  if(channel.mode==="chat") return [
    overwrite(guildId,0,send),
    overwrite(botUserId,1,send|P.manageMessages),
  ];
  return categoryOverwrites(guildId,botUserId,roleIds,category.visibility);
}
function safeSnapshot(roles,channels,guildId) {
  if(!Array.isArray(roles)||!Array.isArray(channels)
    ||roles.length>250||channels.length>500
    ||roles.some(role=>!validSnowflake(role?.id)||typeof role.name!=="string")
    ||channels.some(channel=>!validSnowflake(channel?.id)||typeof channel.name!=="string"||!Number.isInteger(channel.type))) {
    throw new Error("The Discord server inventory cannot be represented safely in a complete backup.");
  }
  return {
    version:2,guild_id:guildId,captured_at:new Date().toISOString(),
    roles:roles.map(role=>({id:role.id,name:role.name,permissions:String(role.permissions??"0"),color:Number(role.color??0),
      hoist:Boolean(role.hoist),mentionable:Boolean(role.mentionable),position:Number(role.position??0),managed:Boolean(role.managed)})),
    channels:channels.map(channel=>({
      id:channel.id,name:channel.name,type:channel.type,parent_id:channel.parent_id??null,
      position:Number(channel.position??0),topic:channel.topic??null,nsfw:Boolean(channel.nsfw),
      rate_limit_per_user:Number(channel.rate_limit_per_user??0),bitrate:Number(channel.bitrate??0),
      user_limit:Number(channel.user_limit??0),rtc_region:channel.rtc_region??null,
      video_quality_mode:channel.video_quality_mode??null,
      default_auto_archive_duration:channel.default_auto_archive_duration??null,
      default_thread_rate_limit_per_user:Number(channel.default_thread_rate_limit_per_user??0),
      permission_overwrites:Array.isArray(channel.permission_overwrites)?channel.permission_overwrites:[],
    })),
    warning:"Discord channel deletion permanently removes message history. This configuration snapshot contains roles, channels, topics, settings and permission overwrites, but not messages.",
  };
}

export class DiscordServerRebuilder {
  constructor(config,dependencies={}) {
    this.guildId=config.guildId;
    this.botUserId=config.botUserId;
    this.api=dependencies.api;
    this.store=dependencies.store;
    this.logger=dependencies.logger??console;
    this.onPanelsReady=dependencies.onPanelsReady??(async()=>({posted:0,errors:[]}));
  }

  async permissionPreflight({invocationChannelId=null}={}) {
    const [roles,botMember,channels,guild]=await Promise.all([
      this.api.request("/guilds/"+this.guildId+"/roles"),
      this.api.request("/guilds/"+this.guildId+"/members/"+this.botUserId),
      this.api.request("/guilds/"+this.guildId+"/channels"),
      this.api.request("/guilds/"+this.guildId),
    ]);
    if(!Array.isArray(roles)||!Array.isArray(botMember?.roles)||!Array.isArray(channels)||!guild||typeof guild!=="object")
      throw new Error("Discord server inventory could not be read; no server changes were made.");
    const roleMap=new Map(roles.map(role=>[role.id,role]));
    const botRoles=[this.guildId,...botMember.roles].map(id=>roleMap.get(id)).filter(Boolean);
    const botTop=Math.max(0,...botRoles.map(role=>Number(role.position??0)));
    const perms=botRoles.reduce((value,role)=>value|BigInt(role.permissions??"0"),0n);
    const required=["manageChannels","manageRoles","manageGuild","manageEvents","manageWebhooks","viewAuditLog","kickMembers","banMembers","moderateMembers","viewChannel","sendMessages","embedLinks","readMessageHistory"];
    // Discord ADMINISTRATOR grants every permission implicitly; its bit does not include each individual permission bit.
    const hasAdministrator=(perms&P.administrator)===P.administrator;
    const missing=hasAdministrator?[]:required.filter(key=>(perms&P[key])!==P[key]);
    if(missing.length) throw new Error("The bot is missing required permissions: "+missing.join(", ")+". No server changes were made.");
    // A full reset deletes every ordinary custom role, not only roles created by earlier Snoozer layouts.
    // Keep @everyone, managed integration roles, and every role assigned to the bot so it retains API access.
    const protectedRoleIds=new Set(botMember.roles);
    const replaceableRoles=roles.filter(role=>role.id!==this.guildId&&!role.managed&&!protectedRoleIds.has(role.id));
    const blockedRoles=replaceableRoles.filter(role=>Number(role.position??0)>=botTop);
    if(blockedRoles.length) throw new Error("The bot role is below or level with roles that must be removed: "+blockedRoles.map(role=>role.name).join(", ")+". Move the bot's highest role above every ordinary server role, then retry. No server changes were made.");

    // Discord Community guilds require their Rules/Guidelines and Community Updates channels to remain.
    // Also keep safety/system destinations, the invocation channel, and Snoozer's one-time setup marker.
    const protectedChannelReasons=new Map();
    const addProtectedChannel=(id,reason)=>{
      if(typeof id!=="string"||!validSnowflake(id))return;
      const channel=channels.find(item=>item.id===id);
      if(channel&&!protectedChannelReasons.has(id))protectedChannelReasons.set(id,reason);
    };
    for(const [field,reason] of [
      ["rules_channel_id","Discord Community rules/guidelines channel"],
      ["public_updates_channel_id","Discord Community updates channel"],
      ["safety_alerts_channel_id","Discord Community safety-alerts channel"],
      ["system_channel_id","Discord server system channel"],
      ["afk_channel_id","Discord AFK channel"],
    ]) addProtectedChannel(guild[field],reason);
    for(const channel of channels) {
      if(normaliseRole(String(channel.name??"").replaceAll("-"," "))==="snoozer setup state")
        addProtectedChannel(channel.id,"Snoozer one-time setup marker");
    }
    addProtectedChannel(invocationChannelId,"Channel where the rebuild command was invoked");
    const protectedChannelIds=new Set(protectedChannelReasons.keys());
    return {roles,channels,guild,botMember,botTop,permissions:perms,protectedRoleIds,replaceableRoles,
      protectedChannelIds,protectedChannels:channels.filter(channel=>protectedChannelIds.has(channel.id))
        .map(channel=>({id:channel.id,name:channel.name,type:channel.type,reason:protectedChannelReasons.get(channel.id)}))};
  }

  async listMembers() {
    const members=[];
    let after="0";
    for(let page=0;page<100;page++) {
      const batch=await this.api.request("/guilds/"+this.guildId+"/members?limit=1000&after="+after);
      if(!Array.isArray(batch)) throw new Error("Discord member inventory returned an unexpected response.");
      members.push(...batch);
      if(batch.length<1000) return members;
      after=batch[batch.length-1]?.user?.id??"";
      if(!validSnowflake(after)) throw new Error("Discord member pagination returned an invalid cursor.");
    }
    throw new Error("The server has more than 100,000 members; the safe role-migration limit was reached before deletion.");
  }

  async ensureRoles(existingRoles) {
    const byName=new Map(existingRoles.map(role=>[role.name,role]));
    const roleIds={};
    for(const definition of SNOOZER_ROLE_LAYOUT) {
      const old=byName.get(definition.name);
      const body={name:definition.name,permissions:bitfield(definition.permissions).toString(),
        color:definition.color,hoist:definition.hoist,mentionable:false};
      const role=old
        ? await this.api.request("/guilds/"+this.guildId+"/roles/"+old.id,{method:"PATCH",body})
        : await this.api.request("/guilds/"+this.guildId+"/roles",{method:"POST",body});
      if(!validSnowflake(role?.id)) throw new Error("Discord failed to create the new role "+definition.name+".");
      roleIds[definition.key]=role.id;
    }
    return roleIds;
  }


  async positionManagedRoles(roleIds) {
    const [roles,member]=await Promise.all([
      this.api.request("/guilds/"+this.guildId+"/roles"),
      this.api.request("/guilds/"+this.guildId+"/members/"+this.botUserId),
    ]);
    const roleMap=new Map(roles.map(role=>[role.id,role]));
    const botPosition=Math.max(0,...[this.guildId,...(member.roles??[])].map(id=>Number(roleMap.get(id)?.position??0)));
    const ordered=SNOOZER_ROLE_LAYOUT.filter(role=>roleIds[role.key]);
    if(botPosition<=ordered.length) throw new Error("The bot role hierarchy is too low to position all Snoozer roles safely. Move the bot role higher and retry.");
    const positions=ordered.map((role,index)=>({id:roleIds[role.key],position:botPosition-1-index}));
    await this.api.request("/guilds/"+this.guildId+"/roles",{method:"PATCH",body:positions});
  }

  async ensureCategory(category,roleIds) {
    const channels=await this.api.request("/guilds/"+this.guildId+"/channels");
    const found=channels.find(channel=>channel.type===4&&channel.name===category.name);
    const body={name:category.name,type:4,permission_overwrites:categoryOverwrites(this.guildId,this.botUserId,roleIds,category.visibility)};
    const result=found
      ? await this.api.request("/channels/"+found.id,{method:"PATCH",body})
      : await this.api.request("/guilds/"+this.guildId+"/channels",{method:"POST",body});
    if(!validSnowflake(result?.id)) throw new Error("Discord failed to create category "+category.name+".");
    return result;
  }

  async ensureChannel(category,channel,parent,roleIds) {
    const channels=await this.api.request("/guilds/"+this.guildId+"/channels");
    const found=channels.find(item=>item.type===(channel.type==="voice"?2:0)&&item.name===channel.name);
    const body={name:channel.name,type:channel.type==="voice"?2:0,parent_id:parent.id,
      permission_overwrites:channelOverwrites(this.guildId,this.botUserId,roleIds,category,channel)};
    // Discord only accepts the topic field on text-like channels. Sending it on a voice
    // channel causes HTTP 400 / INVALID_FORM_BODY and aborts the rebuild part-way through.
    if(channel.type!=="voice"&&typeof channel.topic==="string")body.topic=channel.topic;
    const result=found
      ? await this.api.request("/channels/"+found.id,{method:"PATCH",body})
      : await this.api.request("/guilds/"+this.guildId+"/channels",{method:"POST",body});
    if(!validSnowflake(result?.id)) throw new Error("Discord failed to create channel "+channel.name+".");
    return result;
  }

  async createNewStructure() {
    const roleInventory=await this.api.request("/guilds/"+this.guildId+"/roles");
    const roleIds=await this.ensureRoles(roleInventory);
    await this.positionManagedRoles(roleIds);
    const resources=[{resource_key:"guild",resource_type:"category",discord_id:this.guildId,name:"Snoozer Discord Guild"}];
    const categories={};
    const channelIds={};
    for(const category of SNOOZER_SERVER_LAYOUT) {
      const parent=await this.ensureCategory(category,roleIds);
      categories[category.key]=parent;
      resources.push({resource_key:"category_"+category.key,resource_type:"category",discord_id:parent.id,name:category.name});
      for(const channel of category.channels) {
        const created=await this.ensureChannel(category,channel,parent,roleIds);
        channelIds[channel.key]=created.id;
        resources.push({resource_key:channel.key,resource_type:channel.type==="voice"?"voice":"text",discord_id:created.id,name:channel.name});
      }
    }
    for(const role of SNOOZER_ROLE_LAYOUT) {
      resources.push({resource_key:"role_"+role.key,resource_type:"role",discord_id:roleIds[role.key],name:role.name});
    }
    const ok=await this.store.registerResources(this.guildId,resources);
    if(ok!==true) throw new Error("Discord resources were created but their new IDs could not be committed to Supabase. The old server layout has not been deleted.");
    return {roleIds,channelIds,categories,resources};
  }

  async migrateMemberRoles(members,oldRoles,newRoleIds,deletedRoleIds=[]) {
    const deleted=new Set(deletedRoleIds);
    const oldMap=new Map();
    for(const role of oldRoles) {
      if(role.managed) continue;
      const key=LEGACY_ROLE_NAMES.get(normaliseRole(role.name));
      // Entitlement roles are removed here and only granted again by verified Supabase sync.
      if(key) oldMap.set(role.id,key==="premium"||key==="creator"?null:key);
    }
    let updated=0;
    for(const member of members) {
      const userId=member.user?.id;
      if(!validSnowflake(userId)||userId===this.botUserId) continue;
      // Remove every role deleted by the reset, including custom roles unknown to Snoozer.
      const assigned=member.roles??[];
      const roles=new Set(assigned.filter(id=>!deleted.has(id)&&!oldMap.has(id)));
      const mapped=new Set(assigned.map(id=>oldMap.get(id)).filter(Boolean));
      if(member.user?.bot) mapped.add("bots");
      else {
        mapped.add("member");
        if(member.premium_since) mapped.add("booster");
      }
      for(const key of mapped) if(newRoleIds[key]) roles.add(newRoleIds[key]);
      const next=[...roles];
      if(next.length!==assigned.length||next.some(id=>!assigned.includes(id))) {
        await this.api.request("/guilds/"+this.guildId+"/members/"+userId,{method:"PATCH",body:{roles:next}});
        updated++;
      }
    }
    return updated;
  }

  async syncMembershipRoles(roleIds) {
    const targets=await this.store.roleSyncTargets(this.guildId);
    if(!Array.isArray(targets)) return {checked:0,updated:0};
    let updated=0;
    for(const target of targets) {
      if(typeof target.discord_user_id!=="string"||!validSnowflake(target.discord_user_id)) continue;
      let member;
      try { member=await this.api.request("/guilds/"+this.guildId+"/members/"+target.discord_user_id); }
      catch(error) {
        if(String(error?.message??"").includes("404")) continue;
        throw error;
      }
      const roles=new Set(member.roles??[]);
      let changed=false;
      for(const [flag,key] of [["premium","premium"],["creator","creator"]]) {
        const id=roleIds[key];
        if(!id) continue;
        if(target[flag]&&!roles.has(id)){roles.add(id);changed=true;}
        if(!target[flag]&&roles.has(id)){roles.delete(id);changed=true;}
      }
      if(changed) {
        await this.api.request("/guilds/"+this.guildId+"/members/"+target.discord_user_id,{method:"PATCH",body:{roles:[...roles]}});
        updated++;
      }
    }
    return {checked:targets.length,updated};
  }

  async deleteOldChannels(oldChannels,initiallyProtectedIds=[]) {
    const protectedIds=new Set(initiallyProtectedIds);
    const preservedById=new Map(oldChannels.filter(channel=>protectedIds.has(channel.id))
      .map(channel=>[channel.id,{name:channel.name,id:channel.id,reason:"Discord Community/system channel or required Snoozer channel"}]));
    const nonCategories=oldChannels.filter(channel=>channel.type!==4);
    const categories=oldChannels.filter(channel=>channel.type===4);
    const errors=[];
    let deleted=0;
    for(const channel of [...nonCategories,...categories]) {
      if(protectedIds.has(channel.id))continue;
      try {
        await this.api.request("/channels/"+channel.id,{method:"DELETE"});
        deleted++;
      } catch(error) {
        const detail=String(error?.message??error);
        // Discord may identify a required Community channel even if the guild payload omitted its ID.
        // 50074 is expected protection, not a failed deletion that should abort the rebuild.
        if(detail.includes("Discord code 50074")||detail.toLowerCase().includes("cannot delete a channel required for community")) {
          protectedIds.add(channel.id);
          preservedById.set(channel.id,{name:channel.name,id:channel.id,reason:"Discord requires this channel for Community"});
          continue;
        }
        errors.push({name:channel.name,id:channel.id,error:detail.slice(0,500)});
      }
    }
    return {deleted,remaining:errors,preserved:[...preservedById.values()]};
  }

  async deleteOldRoles(oldRoles,protectedRoleIds=[]) {
    const protectedIds=new Set([this.guildId,...protectedRoleIds]);
    const targets=oldRoles.filter(role=>!protectedIds.has(role.id)&&!role.managed&&role.id!==this.guildId);
    const errors=[];
    const deletedIds=[];
    for(const role of targets) {
      try {
        await this.api.request("/guilds/"+this.guildId+"/roles/"+role.id,{method:"DELETE"});
        deletedIds.push(role.id);
      } catch(error) {
        errors.push({name:role.name,id:role.id,error:String(error?.message??error).slice(0,500)});
      }
    }
    return {deleted:deletedIds.length,deletedIds,preserved:oldRoles.length-targets.length,remaining:errors};
  }


  async restoreLatest(actorId) {
    if(!validSnowflake(actorId)) throw new Error("A valid administrator account is required.");
    const backup=await this.store.latestBackup(this.guildId);
    if(!backup?.snapshot||!Array.isArray(backup.snapshot.roles)||!Array.isArray(backup.snapshot.channels)) {
      throw new Error("No usable Snoozer server configuration backup exists.");
    }
    const [currentRoles,currentChannels]=await Promise.all([
      this.api.request("/guilds/"+this.guildId+"/roles"),
      this.api.request("/guilds/"+this.guildId+"/channels"),
    ]);
    if(!Array.isArray(currentRoles)||!Array.isArray(currentChannels)) throw new Error("The current Discord server inventory could not be read.");
    const roleMap=new Map([[this.guildId,this.guildId],[this.botUserId,this.botUserId]]);
    const rolesByName=new Map(currentRoles.map(role=>[String(role.name).toLowerCase(),role]));
    let rolesRestored=0;
    for(const previous of backup.snapshot.roles) {
      if(!previous||previous.id===this.guildId||previous.managed||!previous.name) continue;
      let existing=rolesByName.get(String(previous.name).toLowerCase());
      if(!existing) {
        existing=await this.api.request("/guilds/"+this.guildId+"/roles",{method:"POST",body:{
          name:previous.name,permissions:String(previous.permissions??"0"),color:Number(previous.color??0),
          hoist:Boolean(previous.hoist),mentionable:Boolean(previous.mentionable),
        }});
        if(!validSnowflake(existing?.id)) throw new Error("Discord failed to restore role "+previous.name+".");
        rolesByName.set(String(previous.name).toLowerCase(),existing);rolesRestored++;
      }
      roleMap.set(previous.id,existing.id);
    }
    const categoryMap=new Map([[this.guildId,this.guildId]]);
    let channelsRestored=0;
    const categories=backup.snapshot.channels.filter(channel=>channel?.type===4);
    const others=backup.snapshot.channels.filter(channel=>channel&&channel.type!==4);
    const findExisting=(previous)=>currentChannels.find(channel=>channel.type===previous.type&&String(channel.name).toLowerCase()===String(previous.name).toLowerCase());
    for(const previous of categories) {
      let existing=findExisting(previous);
      if(!existing) {
        existing=await this.api.request("/guilds/"+this.guildId+"/channels",{method:"POST",body:{
          name:previous.name,type:4,permission_overwrites:(previous.permission_overwrites??[]).map(item=>({
            id:roleMap.get(item.id)??item.id,type:item.type,allow:item.allow,deny:item.deny,
          })).filter(item=>item.id===this.guildId||item.id===this.botUserId||[...roleMap.values()].includes(item.id)),
        }});
        if(!validSnowflake(existing?.id)) throw new Error("Discord failed to restore category "+previous.name+".");
        channelsRestored++;
      }
      categoryMap.set(previous.id,existing.id);
    }
    for(const previous of others) {
      let existing=findExisting(previous);
      if(existing) continue;
      const overwrites=(previous.permission_overwrites??[]).map(item=>({
        id:roleMap.get(item.id)??item.id,type:item.type,allow:item.allow,deny:item.deny,
      })).filter(item=>item.id===this.guildId||item.id===this.botUserId||[...roleMap.values()].includes(item.id));
      const body={
        name:previous.name,type:previous.type,
        parent_id:categoryMap.get(previous.parent_id)??null,
        permission_overwrites:overwrites,
      };
      if(previous.topic!==null&&previous.topic!==undefined)body.topic=previous.topic;
      if(previous.nsfw!==undefined)body.nsfw=Boolean(previous.nsfw);
      if(previous.rate_limit_per_user!==undefined)body.rate_limit_per_user=Number(previous.rate_limit_per_user);
      if(previous.bitrate!==undefined&&Number(previous.bitrate)>0)body.bitrate=Number(previous.bitrate);
      if(previous.user_limit!==undefined&&Number(previous.user_limit)>0)body.user_limit=Number(previous.user_limit);
      if(previous.rtc_region)body.rtc_region=previous.rtc_region;
      if(previous.video_quality_mode!==null&&previous.video_quality_mode!==undefined)body.video_quality_mode=previous.video_quality_mode;
      if(previous.default_auto_archive_duration)body.default_auto_archive_duration=previous.default_auto_archive_duration;
      if(previous.default_thread_rate_limit_per_user!==undefined)body.default_thread_rate_limit_per_user=Number(previous.default_thread_rate_limit_per_user);
      existing=await this.api.request("/guilds/"+this.guildId+"/channels",{method:"POST",body});
      if(!validSnowflake(existing?.id)) throw new Error("Discord failed to restore channel "+previous.name+".");
      channelsRestored++;
    }
    return {backupId:backup.id,rolesRestored,channelsRestored,sourceCreatedAt:backup.created_at};
  }

  async pruneOldBackups(){
    if(typeof this.store.pruneBackups!=="function")return 0;
    try{return await this.store.pruneBackups(this.guildId,30);}
    catch(error){this.logger.warn("[discord-server] backup retention cleanup failed",error?.message??error);return 0;}
  }

  async createBackup(actorId) {
    if(!validSnowflake(actorId)) throw new Error("A valid administrator or bot account is required.");
    const [roles,channels]=await Promise.all([
      this.api.request("/guilds/"+this.guildId+"/roles"),
      this.api.request("/guilds/"+this.guildId+"/channels"),
    ]);
    if(!Array.isArray(roles)||!Array.isArray(channels)) throw new Error("Discord server inventory could not be read.");
    const snapshot=safeSnapshot(roles,channels,this.guildId);
    const backupId=await this.store.saveBackup(this.guildId,actorId,snapshot);
    if(typeof backupId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(backupId))throw new Error("The server configuration backup could not be saved.");
    await this.pruneOldBackups();
    return {backupId,roleCount:snapshot.roles.length,channelCount:snapshot.channels.length};
  }

  async reconcile(actorId) {
    if(!validSnowflake(actorId)) throw new Error("A valid administrator is required.");
    const before=await this.permissionPreflight();
    const members=await this.listMembers();
    const backup=await this.store.saveBackup(this.guildId,actorId,safeSnapshot(before.roles,before.channels,this.guildId));
    if(!backup)throw new Error("The pre-reconcile backup could not be saved. No server changes were made.");
    await this.pruneOldBackups();
    const created=await this.createNewStructure();
    const memberRolesMigrated=await this.migrateMemberRoles(members,before.roles,created.roleIds);
    const roleSync=await this.syncMembershipRoles(created.roleIds);
    let panelResult={posted:0,errors:[]};
    try{panelResult=await this.onPanelsReady({channelIds:created.channelIds,roleIds:created.roleIds});}
    catch(error){panelResult={posted:0,errors:[String(error?.message??error).slice(0,500)]};}
    return {
      backupId:backup,
      categoryCount:Object.keys(created.categories).length,
      channelCount:Object.keys(created.channelIds).length,
      roleCount:Object.keys(created.roleIds).length,
      memberCount:members.length,
      memberRolesMigrated,
      roleSync,
      panelResult,
      complete:panelResult.errors.length===0,
    };
  }

  async rebuild(actorId,{invocationChannelId=null}={}) {
    if(!validSnowflake(actorId)) throw new Error("A valid administrator account is required.");
    const before=await this.permissionPreflight({invocationChannelId});
    const members=await this.listMembers();
    const snapshot=safeSnapshot(before.roles,before.channels,this.guildId);
    const backupId=await this.store.saveBackup(this.guildId,actorId,snapshot);
    if(!backupId) throw new Error("The old server configuration backup was not saved. No server changes were made.");
    await this.pruneOldBackups();

    // Empty the existing layout before creating anything new. Keep @everyone,
    // integration-managed roles, and the bot's own assigned roles so it retains access.
    const channelResult=await this.deleteOldChannels(before.channels,before.protectedChannelIds??[]);
    if(channelResult.remaining.length) {
      const failures=channelResult.remaining.map(item=>item.name+" ("+item.id+"): "+item.error).join("; ");
      const deletableChannels=before.channels.length-(channelResult.preserved?.length??0);
      throw new Error("The reset stopped before rebuilding because "+channelResult.remaining.length+" of "+deletableChannels+" deletable channels could not be deleted. Removed "+channelResult.deleted+" and preserved "+(channelResult.preserved?.length??0)+" required channels. Failures: "+failures+". The configuration backup is "+backupId+".");
    }

    const roleResult=await this.deleteOldRoles(before.roles,before.protectedRoleIds??before.botMember?.roles??[]);
    if(roleResult.remaining.length) {
      const failures=roleResult.remaining.map(item=>item.name+" ("+item.id+"): "+item.error).join("; ");
      throw new Error("The reset stopped before rebuilding because "+roleResult.remaining.length+" roles could not be deleted. Removed "+roleResult.deleted+" ordinary roles. Failures: "+failures+". The configuration backup is "+backupId+".");
    }

    const deletedRoleIds=roleResult.deletedIds;
    const created=await this.createNewStructure();
    const memberRolesMigrated=await this.migrateMemberRoles(members,before.roles,created.roleIds,deletedRoleIds);
    const roleSync=await this.syncMembershipRoles(created.roleIds);
    let panelResult={posted:0,errors:[]};
    try { panelResult=await this.onPanelsReady({channelIds:created.channelIds,roleIds:created.roleIds}); }
    catch(error) { panelResult={posted:0,errors:[String(error?.message??error).slice(0,500)]}; }
    return {
      backupId,categoryCount:Object.keys(created.categories).length,
      channelCount:Object.keys(created.channelIds).length,
      roleCount:Object.keys(created.roleIds).length,
      memberCount:members.length,memberRolesMigrated,
      channelsDeleted:channelResult.deleted,channelsPreserved:channelResult.preserved,
      channelDeletionErrors:channelResult.remaining,
      rolesDeleted:roleResult.deleted,rolesPreserved:roleResult.preserved,roleDeletionErrors:roleResult.remaining,
      roleSync,panelResult,
      complete:channelResult.remaining.length===0&&roleResult.remaining.length===0&&panelResult.errors.length===0,
    };
  }
}
