import test from "node:test";
import assert from "node:assert/strict";

import { SNOOZER_ROLE_LAYOUT, SNOOZER_SERVER_LAYOUT, SNOOZER_RESOURCE_KEYS } from "../workers/discord-presence/server-layout.mjs";
import { DiscordStore } from "../workers/discord-presence/discord-store.mjs";
import { DiscordServerRebuilder } from "../workers/discord-presence/server-rebuilder.mjs";
import { DiscordCommunityPanels, SNOOZER_REBUILD_COMMAND } from "../workers/discord-presence/community-panels.mjs";
import { DiscordSecurityGuard } from "../workers/discord-presence/security-guard.mjs";

const guildId = "1574262035519115284";
const botUserId = "1574262035519115285";
const snowflake = value => /^[1-9][0-9]{16,19}$/.test(value);

test("new Snoozer server layout has unique resource keys and names", () => {
  const categoryKeys = SNOOZER_SERVER_LAYOUT.map(category => category.key);
  assert.equal(new Set(categoryKeys).size, categoryKeys.length);

  const channelKeys = SNOOZER_SERVER_LAYOUT.flatMap(category => category.channels.map(channel => channel.key));
  assert.equal(new Set(channelKeys).size, channelKeys.length);
  assert.ok(channelKeys.includes("welcome"));
  assert.ok(channelKeys.includes("member_hub"));
  assert.ok(channelKeys.includes("ticket_panel"));
  assert.ok(channelKeys.includes("service_status"));
  assert.ok(channelKeys.includes("bot_control"));
  assert.ok(channelKeys.includes("moderation_log"));
  assert.ok(channelKeys.includes("security_alerts"));
  assert.ok(channelKeys.includes("server_boosts"));
  assert.ok(channelKeys.includes("goodbye"));

  const roleKeys = SNOOZER_ROLE_LAYOUT.map(role => role.key);
  assert.equal(new Set(roleKeys).size, roleKeys.length);
  for (const required of ["admin","moderator","premium","creator","member","booster","notify_updates","notify_events","notify_giveaways"]) {
    assert.ok(roleKeys.includes(required), "missing role " + required);
  }

  const resourceKeys = SNOOZER_RESOURCE_KEYS.map(resource => resource.key);
  assert.equal(new Set(resourceKeys).size, resourceKeys.length);
  assert.ok(SNOOZER_SERVER_LAYOUT.every(category => category.name.length <= 100));
  assert.ok(SNOOZER_SERVER_LAYOUT.flatMap(category => category.channels).every(channel => channel.name.length <= 100));
});

test("DiscordStore uses the service-only public RPC surface", async () => {
  let captured;
  const store = new DiscordStore({
    url: "https://example.supabase.co",
    serviceKey: "test-service-role-key",
  }, {
    fetcher: async (url, options) => {
      captured = { url, options };
      return new Response("true", { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const ok = await store.registerResources(guildId, [{
    resource_key: "guild",
    resource_type: "category",
    discord_id: guildId,
    name: "Snoozer Discord Guild",
  }]);
  assert.equal(ok, true);
  assert.equal(captured.url, "https://example.supabase.co/rest/v1/rpc/discord_bot_register_resources");
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.options.headers.apikey, "test-service-role-key");
  assert.equal(captured.options.headers["Content-Profile"], "public");
  assert.deepEqual(JSON.parse(captured.options.body), {
    p_guild_id: guildId,
    p_resources: [{
      resource_key: "guild", resource_type: "category", discord_id: guildId, name: "Snoozer Discord Guild",
    }],
  });
});

test("DiscordStore rejects invalid Supabase configuration and RPC names", async () => {
  assert.throws(() => new DiscordStore({ url: "http://not-https", serviceKey: "key" }), /not configured/i);
  const store = new DiscordStore({ url: "https://example.supabase.co", serviceKey: "key" }, {
    fetcher: async () => new Response("{}", { status: 200 }),
  });
  await assert.rejects(store.rpc("../admin"), /Invalid internal Discord RPC name/);
});

test("server reset preflight stops before writes when the bot lacks permissions", async () => {
  const writes = [];
  const api = {
    async request(path, options = {}) {
      if (path.endsWith("/roles")) return [{ id: guildId, permissions: "0", position: 0 }];
      if (path.endsWith("/members/" + botUserId)) return { roles: [] };
      if (path.endsWith("/channels")) return [];
      writes.push({ path, options });
      return {};
    },
  };
  const store = { async saveBackup() { throw new Error("must not reach backup"); } };
  const rebuilder = new DiscordServerRebuilder({ guildId, botUserId }, { api, store });
  await assert.rejects(rebuilder.rebuild(botUserId), /missing required permissions/i);
  assert.equal(writes.length, 0);
});

test("server reset preflight refuses a bot role below managed legacy roles", async () => {
  const permissionBits = (1n << 1n) | (1n << 2n) | (1n << 4n) | (1n << 5n) | (1n << 7n)
    | (1n << 10n) | (1n << 11n) | (1n << 13n) | (1n << 14n) | (1n << 16n)
    | (1n << 28n) | (1n << 29n) | (1n << 33n) | (1n << 40n);
  const api = {
    async request(path) {
      if (path.endsWith("/roles")) return [
        { id: guildId, permissions: "0", position: 0, name: "@everyone" },
        { id: "1574262035519115286", permissions: permissionBits.toString(), position: 10, name: "Snoozer Bot" },
        { id: "1574262035519115287", permissions: "0", position: 11, name: "Snoozer Admin" },
      ];
      if (path.endsWith("/members/" + botUserId)) return { roles: ["1574262035519115286"] };
      if (path.endsWith("/channels")) return [];
      throw new Error("unexpected request " + path);
    },
  };
  const rebuilder = new DiscordServerRebuilder({ guildId, botUserId }, { api, store: {} });
  await assert.rejects(rebuilder.permissionPreflight(), /Move the bot role above/i);
});

test("member-role migration never copies unverified Premium or Creator roles", async () => {
  const oldRoles = [
    { id: "1574262035519115301", name: "Premium" },
    { id: "1574262035519115302", name: "Creator" },
    { id: "1574262035519115303", name: "Member" },
    { id: "1574262035519115304", name: "Snoozer Admin" },
  ];
  let patch;
  const api = {
    async request(path, options = {}) {
      if (options.method === "PATCH") patch = JSON.parse(options.body ? JSON.stringify(options.body) : "{}");
      return {};
    },
  };
  const rebuilder = new DiscordServerRebuilder({ guildId, botUserId }, { api, store: {} });
  await rebuilder.migrateMemberRoles([{
    user: { id: "1574262035519115310", bot: false },
    roles: oldRoles.map(role => role.id),
  }], oldRoles, {
    premium: "1574262035519115321",
    creator: "1574262035519115322",
    member: "1574262035519115323",
    admin: "1574262035519115324",
  });
  assert.ok(patch.roles.includes("1574262035519115323"));
  assert.ok(patch.roles.includes("1574262035519115324"));
  assert.ok(!patch.roles.includes("1574262035519115301"));
  assert.ok(!patch.roles.includes("1574262035519115302"));
  assert.ok(!patch.roles.includes("1574262035519115321"));
  assert.ok(!patch.roles.includes("1574262035519115322"));
});

test("rebuild command uses the full confirmation phrase and button controls are present", () => {
  assert.equal("REBUILD SNOOZER SERVER".length, 22);
  assert.equal(SNOOZER_REBUILD_COMMAND.options[0].min_length, 22);
  assert.equal(SNOOZER_REBUILD_COMMAND.options[0].max_length, 22);
  assert.equal(typeof DiscordCommunityPanels.prototype.ticketAction, "function");
  assert.equal(typeof DiscordCommunityPanels.prototype.publishPermanentPanels, "function");
  assert.ok(snowflake(guildId));
});


test("security guard locks public chat after a join burst and restores exact overwrites", async () => {
  const state = { config: { security: { raidJoinThreshold: 2, raidLockdownSeconds: 300 } }, writes: [], events: [] };
  const channels = [{
    id: "1574262035519115401", type: 0, parent_id: "1574262035519115410", permission_overwrites: [],
  },{
    id: "1574262035519115402", type: 0, parent_id: "1574262035519115410",
    permission_overwrites: [{ id: guildId, type: 0, allow: "1024", deny: "0" }],
  }];
  const api = {
    async request(path, options = {}) {
      if (path === "/guilds/" + guildId) return { owner_id: "1574262035519115299" };
      if (path === "/guilds/" + guildId + "/channels") return structuredClone(channels);
      if (path.startsWith("/channels/") && options.method === "PATCH") {
        state.writes.push({ path, body: structuredClone(options.body) });
        return {};
      }
      if (path.startsWith("/channels/") && options.method === "POST") return {};
      throw new Error("unexpected API request " + path);
    },
  };
  const store = {
    async getConfig() { return structuredClone(state.config); },
    async setConfig(guild,key,value) { state.config = { ...state.config, [key]: structuredClone(value) }; return true; },
    async recordSecurityEvent(event) { state.events.push(event); return "event-id"; },
  };
  const guard = new DiscordSecurityGuard({ guildId, botUserId }, {
    api, store,
    getResources: () => ({ category_community: "1574262035519115410", security_alerts: "1574262035519115420" }),
  });
  await guard.initialise();
  await guard.handleMemberJoin({ user: { id: "1574262035519115321", bot: false } });
  await guard.handleMemberJoin({ user: { id: "1574262035519115322", bot: false } });
  assert.equal(state.config.raid_lockdown.active, true);
  assert.equal(state.writes.length, 2);
  const deny = BigInt(state.writes[0].body.permission_overwrites[0].deny);
  assert.ok((deny & (1n << 11n)) !== 0n);
  state.config.raid_lockdown.expires_at = new Date(0).toISOString();
  await guard.restoreExpiredLockdown();
  assert.equal(state.config.raid_lockdown.active, false);
  assert.deepEqual(state.writes[2].body.permission_overwrites, []);
  assert.deepEqual(state.writes[3].body.permission_overwrites, channels[1].permission_overwrites);
});

test("security guard records and removes an emergency mass-mention message", async () => {
  const calls = [];
  const store = {
    async recordSecurityEvent(event) { calls.push({ kind: "event", event }); },
    async getConfig() { return {}; },
    async setConfig() { return true; },
  };
  const api = { async request(path, options = {}) { calls.push({ path, method: options.method ?? "GET" }); return {}; } };
  const guard = new DiscordSecurityGuard({ guildId, botUserId }, {
    api, store, getResources: () => ({ security_alerts: "1574262035519115420" }),
  });
  const removed = await guard.handleMessage({
    guild_id: guildId, id: "1574262035519115330", channel_id: "1574262035519115401",
    author: { id: "1574262035519115331", bot: false },
    content: "", mention_everyone: true, mentions: [], mention_roles: [],
  });
  assert.equal(removed, true);
  assert.ok(calls.some(call => call.path === "/channels/1574262035519115401/messages/1574262035519115330" && call.method === "DELETE"));
  assert.ok(calls.some(call => call.kind === "event" && call.event.action === "automod_spam"));
});

test("security guard raises a temporary lockdown after repeated destructive audit actions", async () => {
  const config = { security: { antiNukeActions: 2, antiNukeWindowSeconds: 30, raidLockdownSeconds: 120 } };
  const patches = [];
  const api = {
    async request(path, options = {}) {
      if (path === "/guilds/" + guildId) return { owner_id: "1574262035519115299" };
      if (path === "/guilds/" + guildId + "/channels") return [{
        id: "1574262035519115401", type: 0, parent_id: "1574262035519115410", permission_overwrites: [],
      }];
      if (path.startsWith("/channels/") && options.method === "PATCH") patches.push(path);
      return {};
    },
  };
  const store = {
    async getConfig() { return structuredClone(config); },
    async setConfig(guild,key,value) { config[key] = structuredClone(value); return true; },
    async recordSecurityEvent() { return "event-id"; },
  };
  const guard = new DiscordSecurityGuard({ guildId, botUserId }, {
    api, store, getResources: () => ({ category_community: "1574262035519115410", security_alerts: "1574262035519115420" }),
  });
  await guard.initialise();
  await guard.handleAuditEntry({ guild_id:guildId,id:"1574262035519115501",user_id:"1574262035519115510",target_id:"1574262035519115520",action_type:12 });
  await guard.handleAuditEntry({ guild_id:guildId,id:"1574262035519115502",user_id:"1574262035519115510",target_id:"1574262035519115521",action_type:12 });
  assert.equal(config.raid_lockdown.active, true);
  assert.equal(patches.length, 1);
});


test("anti-nuke trusts the Snoozer Admin and Developer roles", async () => {
  const config = { security: { antiNukeActions: 2, antiNukeWindowSeconds: 30 } };
  const calls = [];
  const actorId = "1574262035519115601";
  const adminRoleId = "1574262035519115602";
  const api = {
    async request(path, options = {}) {
      calls.push({ path, method: options.method ?? "GET" });
      if (path === "/guilds/" + guildId) return { owner_id: "1574262035519115299" };
      if (path === "/guilds/" + guildId + "/members/" + actorId) return { roles: [adminRoleId] };
      if (path === "/guilds/" + guildId + "/channels") return [];
      return {};
    },
  };
  const store = {
    async getConfig() { return structuredClone(config); },
    async setConfig(_guild,key,value) { config[key] = structuredClone(value); return true; },
    async recordSecurityEvent() { throw new Error("trusted actor must not create a security incident"); },
  };
  const guard = new DiscordSecurityGuard({ guildId, botUserId }, {
    api, store, getResources: () => ({}), getRoleIds: () => ({ admin: adminRoleId }),
  });
  await guard.initialise();
  const handled = await guard.handleAuditEntry({
    guild_id:guildId,id:"1574262035519115610",user_id:actorId,
    target_id:"1574262035519115611",action_type:12,
  });
  assert.equal(handled, false);
  assert.equal(config.raid_lockdown, undefined);
  assert.ok(calls.some(call => call.path === "/guilds/" + guildId + "/members/" + actorId));
});


test("DiscordStore exposes persistent ticket statistics and staff review RPCs", async () => {
  const calls=[];
  const store=new DiscordStore({url:"https://example.supabase.co",serviceKey:"test-key"},{
    fetcher:async(url,options)=>{
      calls.push({url,body:JSON.parse(options.body)});
      return new Response(JSON.stringify({ok:true}),{status:200,headers:{"content-type":"application/json"}});
    },
  });
  await store.getTicket("2b74a90f-b239-4c62-8f43-e3cd5eaf3f3c");
  await store.ticketStatistics(guildId);
  await store.reviewSubmission("2b74a90f-b239-4c62-8f43-e3cd5eaf3f3c",botUserId,"approved","Looks good");
  assert.ok(calls.some(call=>call.url.endsWith("/discord_bot_ticket_get")));
  assert.ok(calls.some(call=>call.url.endsWith("/discord_bot_ticket_statistics")));
  const review=calls.find(call=>call.url.endsWith("/discord_bot_submission_review"));
  assert.deepEqual(review.body,{p_id:"2b74a90f-b239-4c62-8f43-e3cd5eaf3f3c",p_actor:botUserId,p_decision:"approved",p_note:"Looks good"});
});


test("server configuration backup includes every channel, not just the first 250", async () => {
  let saved;
  const roles=[{id:guildId,name:"@everyone",permissions:"0",position:0}];
  const channels=Array.from({length:270},(_,index)=>({
    id:String(BigInt(guildId)+BigInt(index+10)),name:"channel-"+index,type:0,
    topic:"topic "+index,permission_overwrites:[],
  }));
  const api={async request(path){
    if(path==="/guilds/"+guildId+"/roles")return roles;
    if(path==="/guilds/"+guildId+"/channels")return channels;
    throw new Error("unexpected request "+path);
  }};
  const store={async saveBackup(_guild,_actor,snapshot){saved=snapshot;return "c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c90";},async pruneBackups(_guild,keep){assert.equal(keep,30);}};
  const result=await new DiscordServerRebuilder({guildId,botUserId},{api,store}).createBackup(botUserId);
  assert.equal(result.channelCount,270);
  assert.equal(saved.channels.length,270);
  assert.equal(saved.channels[269].topic,"topic 269");
  assert.equal(saved.version,2);
});

test("server backup rejects an incomplete Discord inventory without saving it", async () => {
  let saves=0;
  const api={async request(path){
    if(path==="/guilds/"+guildId+"/roles")return [{id:guildId,name:"@everyone"}];
    if(path==="/guilds/"+guildId+"/channels")return [{id:"not-a-snowflake",name:"invalid",type:0}];
    throw new Error("unexpected request "+path);
  }};
  const store={async saveBackup(){saves++;return "c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c90";}};
  const rebuilder=new DiscordServerRebuilder({guildId,botUserId},{api,store});
  await assert.rejects(rebuilder.createBackup(botUserId),/cannot be represented safely/i);
  assert.equal(saves,0);
});

test("safe reconciliation preserves the current server and registers unique resource keys", async () => {
  let saved,registered,deleted=false;
  const roleIds=Object.fromEntries(SNOOZER_ROLE_LAYOUT.map((role,index)=>[
    role.key,String(BigInt(guildId)+BigInt(100+index)),
  ]));
  const rebuilder=new DiscordServerRebuilder({guildId,botUserId},{
    api:{async request(path){if(path==="/guilds/"+guildId+"/roles")return [{id:guildId,name:"@everyone",permissions:"0",position:0}];throw new Error("unexpected API call "+path);}},
    store:{
      async saveBackup(_guild,_actor,snapshot){saved=snapshot;return "c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c90";},
      async registerResources(_guild,resources){registered=resources;return true;},
      async roleSyncTargets(){return [];},
    },
    onPanelsReady:async()=>({posted:2,errors:[]}),
  });
  const existingRoles=[{id:guildId,name:"@everyone",permissions:"0",position:0}];
  const existingChannels=[{id:"1574262035519115901",name:"general",type:0,permission_overwrites:[]}];
  rebuilder.permissionPreflight=async()=>({roles:existingRoles,channels:existingChannels,botMember:{roles:[]}});
  rebuilder.listMembers=async()=>[];
  rebuilder.ensureRoles=async()=>roleIds;
  rebuilder.positionManagedRoles=async()=>{};
  rebuilder.ensureCategory=async category=>({id:String(BigInt(guildId)+BigInt(1000+SNOOZER_SERVER_LAYOUT.findIndex(item=>item.key===category.key)))});
  let sequence=0;
  rebuilder.ensureChannel=async()=>({id:String(BigInt(guildId)+BigInt(2000+sequence++))});
  const result=await rebuilder.reconcile(botUserId);
  assert.ok(saved);
  assert.equal(deleted,false);
  assert.equal(new Set(registered.map(item=>item.resource_key)).size,registered.length);
  assert.equal(registered.filter(item=>item.resource_key==="category_tickets").length,1);
  assert.equal(result.complete,true);
});

test("DiscordStore calls the private backup retention RPC", async () => {
  let request;
  const store=new DiscordStore({url:"https://example.supabase.co",serviceKey:"test-key"},{
    fetcher:async(url,options)=>{
      request={url,body:JSON.parse(options.body)};
      return new Response("0",{status:200,headers:{"content-type":"application/json"}});
    },
  });
  await store.pruneBackups(guildId,30);
  assert.ok(request.url.endsWith("/discord_bot_prune_backups"));
  assert.deepEqual(request.body,{p_guild_id:guildId,p_keep:30});
});

test("server rebuilder registers the Tickets category only once", async () => {
  let registered;
  const roleIds=Object.fromEntries(SNOOZER_ROLE_LAYOUT.map((role,index)=>[
    role.key,String(BigInt(guildId)+BigInt(300+index)),
  ]));
  const rebuilder=new DiscordServerRebuilder({guildId,botUserId},{
    api:{async request(path){if(path==="/guilds/"+guildId+"/roles")return [{id:guildId,name:"@everyone",permissions:"0",position:0}];throw new Error("unexpected API call "+path);}},
    store:{async registerResources(_guild,resources){registered=resources;return true;},async roleSyncTargets(){return []; }},
  });
  rebuilder.ensureRoles=async()=>roleIds;
  rebuilder.positionManagedRoles=async()=>{};
  rebuilder.ensureCategory=async category=>({id:String(BigInt(guildId)+BigInt(4000+SNOOZER_SERVER_LAYOUT.findIndex(item=>item.key===category.key)))});
  rebuilder.ensureChannel=async()=>({id:String(BigInt(guildId)+BigInt(5000))});
  rebuilder.syncMembershipRoles=async()=>({checked:1,updated:0});
  await rebuilder.createNewStructure();
  const keys=registered.map(resource=>resource.resource_key);
  assert.equal(keys.length,new Set(keys).size);
  assert.equal(keys.filter(key=>key==="category_tickets").length,1);
});


test("ticket reminders defer when the latest channel message is newer than 24 hours", async () => {
  const scheduled=[];
  const posts=[];
  const state={status:"processing"};
  const panel=Object.create(DiscordCommunityPanels.prototype);
  panel.guildId=guildId;
  panel.logger={error(){}};
  panel.api={async request(path,options={}){
    if(path.endsWith("/messages?limit=1"))return [{timestamp:new Date().toISOString()}];
    if(path.endsWith("/messages")&&options.method==="POST"){posts.push(options.body);return {};}
    throw new Error("unexpected Discord request "+path);
  }};
  panel.store={
    async getTicket(){return {status:"open",created_at:new Date(Date.now()-60*60_000).toISOString()};},
    async enqueueJob(job){scheduled.push(job);state.status="pending";return "job-id";},
    async finishJob(_id,success){if(state.status!=="processing")return false;state.status=success?"done":"failed";return true;},
  };
  await panel.runJob({
    id:"c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c90",job_type:"ticket_reminder",
    payload:{ticket_id:"c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c91",channel_id:"1574262035519115901",reminder_number:1},
  });
  assert.equal(posts.length,0);
  assert.equal(scheduled.length,1);
  assert.equal(scheduled[0].dedupeKey,"ticket-reminder:c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c91:1");
  assert.equal(scheduled[0].payload.reminder_number,1);
  assert.equal(state.status,"pending");
});

test("ticket reminders are capped at three and only continue for active tickets", async () => {
  const scheduled=[];
  const posts=[];
  const panel=Object.create(DiscordCommunityPanels.prototype);
  panel.guildId=guildId;
  panel.logger={error(){}};
  panel.api={async request(path,options={}){
    if(path.endsWith("/messages?limit=1"))return [{timestamp:new Date(Date.now()-48*60*60_000).toISOString()}];
    if(path.endsWith("/messages")&&options.method==="POST"){posts.push(options.body);return {};}
    throw new Error("unexpected Discord request "+path);
  }};
  panel.store={
    async getTicket(){return {status:"open",updated_at:new Date(Date.now()-48*60*60_000).toISOString()};},
    async enqueueJob(job){scheduled.push(job);return "job-id";},
    async finishJob(){return true;},
  };
  await panel.runJob({
    id:"c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c90",job_type:"ticket_reminder",
    payload:{ticket_id:"c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c91",channel_id:"1574262035519115901",reminder_number:3},
  });
  assert.equal(posts.length,1);
  assert.equal(scheduled.length,0);
});

test("ticket reminder jobs do not message tickets that have already closed", async () => {
  const calls=[];
  const panel=Object.create(DiscordCommunityPanels.prototype);
  panel.guildId=guildId;
  panel.logger={error(){}};
  panel.api={async request(){calls.push("discord");return [];}};
  panel.store={
    async getTicket(){return {status:"closed"};},
    async enqueueJob(){calls.push("enqueue");},
    async finishJob(){return true;},
  };
  await panel.runJob({
    id:"c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c90",job_type:"ticket_reminder",
    payload:{ticket_id:"c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c91",channel_id:"1574262035519115901",reminder_number:1},
  });
  assert.deepEqual(calls,[]);
});

test("community slash commands reach the complete router as well as rebuild", async () => {
  const applicationId = "1574262035519115288";
  const handled = [];
  const panels = new DiscordCommunityPanels({ guildId, botUserId, applicationId }, {
    api: { async request() { return {}; } },
    store: { async recordInteraction() { return true; } },
  });
  panels.healthStatus = async () => { handled.push("health"); };
  await panels.handle({
    guild_id: guildId,
    application_id: applicationId,
    type: 2,
    id: "1574262035519115290",
    token: "test-interaction-token",
    user: { id: botUserId },
    member: { permissions: "0", roles: [] },
    data: { name: "snoozer-health", options: [] },
  });
  assert.deepEqual(handled, ["health"]);
});

