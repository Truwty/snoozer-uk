import assert from "node:assert/strict";
import test from "node:test";
import {
  DISCORD_COMMUNITY_COMMANDS,
  DiscordCommunityBot,
  SERVICE_STATUS_POLL_MS,
} from "../workers/discord-presence/community-bot.mjs";

const guildId = "222222222222222222";
const botUserId = "333333333333333333";
const applicationId = "777777777777777777";
const memberId = "444444444444444444";
const moderatorId = "888888888888888888";
const targetId = "999999999999999999";

function createApi({ channels = [], roles = [], memberRoles = [] } = {}) {
  const state = {
    channels: structuredClone(channels),
    roles: structuredClone(roles),
    memberRoles: structuredClone(memberRoles),
    messages: new Map(),
    calls: [],
  };
  let nextId = 700000000000000000n;
  const api = {
    async request(path, options = {}) {
      const method = options.method ?? "GET";
      state.calls.push({ path, method, body: options.body, headers: options.headers ?? {}, auth: options.auth });
      if (path === "/guilds/" + guildId + "/channels" && method === "GET") return structuredClone(state.channels);
      if (path === "/guilds/" + guildId + "/roles" && method === "GET") return structuredClone(state.roles);
      if (path === "/guilds/" + guildId + "/members/" + botUserId && method === "GET") {
        return { user: { id: botUserId }, roles: structuredClone(state.memberRoles) };
      }

      if (path === "/guilds/" + guildId + "/channels" && method === "POST") {
        const channel = { id: String(nextId++), ...structuredClone(options.body) };
        state.channels.push(channel);
        state.messages.set(channel.id, []);
        return structuredClone(channel);
      }

      const channelMessages = path.match(/^\/channels\/([0-9]+)\/messages$/);
      if (channelMessages && method === "POST") {
        const message = { id: String(nextId++), ...structuredClone(options.body) };
        const messages = state.messages.get(channelMessages[1]) ?? [];
        messages.push(message);
        state.messages.set(channelMessages[1], messages);
        return structuredClone(message);
      }

      const channelPath = path.match(/^\/channels\/([0-9]+)$/);
      if (channelPath && method === "GET") {
        const channel = state.channels.find(item => item.id === channelPath[1]);
        return channel ? structuredClone(channel) : null;
      }
      if (channelPath && method === "PATCH") {
        const channel = state.channels.find(item => item.id === channelPath[1]);
        assert.ok(channel, "channel must exist before it is patched");
        Object.assign(channel, structuredClone(options.body));
        return structuredClone(channel);
      }

      return null;
    },
  };
  return { api, state };
}

function botFixture(options = {}) {
  const { api, state } = createApi(options);
  return {
    bot: new DiscordCommunityBot({
      guildId,
      botUserId,
      applicationId,
      channelIds: options.channelIds ?? {},
    }, {
      api,
      fetcher: options.fetcher ?? globalThis.fetch,
      logger: { info() {}, warn() {}, error() {} },
    }),
    api,
    state,
  };
}

function interaction(name, options = [], overrides = {}) {
  return {
    id: "555555555555555555",
    application_id: applicationId,
    guild_id: guildId,
    token: "interaction-token",
    channel_id: "666666666666666666",
    member: {
      user: { id: memberId, username: "community-member" },
      permissions: "0",
      roles: [],
    },
    data: { name, options },
    ...overrides,
  };
}

function statusSnapshot(state = "operational") {
  return {
    checkedAt: "2026-11-28T10:00:00.000Z",
    summary: {
      state,
      label: state === "operational" ? "ALL SYSTEMS OPERATIONAL" : "SERVICE DISRUPTION",
      title: state === "operational" ? "Everything is running smoothly." : "Some services are unavailable.",
      description: "Status from Snoozer's public health page.",
    },
    services: [
      { id: "website", name: "Snoozer website", state, description: "The website is responding." },
      { id: "database", name: "Database", state: "operational", description: "Database checks are passing." },
    ],
    incidentFeed: { incidents: [] },
  };
}

test("registerable command set includes public help/status, private support and staff moderation", () => {
  const names = new Set(DISCORD_COMMUNITY_COMMANDS.map(command => command.name));
  for (const name of [
    "snoozer-help",
    "snoozer-status",
    "snoozer-changelog",
    "snoozer-ticket",
    "snoozer-ticket-close",
    "snoozer-bug",
    "snoozer-suggest",
    "snoozer-report",
    "snoozer-warn",
    "snoozer-timeout",
    "snoozer-kick",
    "snoozer-ban",
  ]) assert.ok(names.has(name), "missing command " + name);
  assert.ok(!names.has("snoozer-repair"), "the retired repair command must not be registered");
  assert.equal(SERVICE_STATUS_POLL_MS, 60_000);
});


test("bot permission preflight clearly reports missing moderation permissions", async () => {
  const botRoleId = "660000000000000001";
  const { bot } = botFixture({
    roles: [
      { id: guildId, name: "@everyone", permissions: "0" },
      { id: botRoleId, name: "Snoozer Bot", permissions: "268520464" },
    ],
    memberRoles: [botRoleId],
  });
  const result = await bot.preflightPermissions();
  assert.deepEqual(result.missing, ["Manage Server", "View Audit Log", "Manage Webhooks", "Manage Events", "Kick Members", "Ban Members", "Moderate Members"]);
});

test("status command renders the live snapshot as a public Snoozer embed", async () => {
  const { bot, state } = botFixture({
    fetcher: async () => new Response(JSON.stringify(statusSnapshot()), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  });
  await bot.handle(interaction("snoozer-status"));
  const edit = state.calls.find(call => call.path.includes("/webhooks/"));
  assert.ok(edit, "interaction response should be completed");
  assert.equal(edit.method, "PATCH");
  assert.equal(edit.body.embeds[0].title, "ALL SYSTEMS OPERATIONAL");
  assert.equal(edit.body.embeds[0].url, "https://status.snoozer.uk");
  assert.equal(edit.body.embeds[0].fields.length, 2);
});

test("status changes are announced once in the existing service-status channel", async () => {
  const { bot, state } = botFixture({
    channels: [{ id: "610000000000000001", name: "service-status", type: 0 }],
    fetcher: async () => new Response(JSON.stringify(statusSnapshot("outage")), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  });
  bot.statusBaseline = "operational";
  await bot.checkAndAnnounceStatus();
  const notice = state.calls.find(call => call.path === "/channels/610000000000000001/messages" && call.method === "POST");
  assert.ok(notice);
  assert.equal(notice.body.embeds[0].title, "Snoozer service disruption reported");
  assert.deepEqual(notice.body.allowed_mentions.parse, []);
  const callCount = state.calls.length;
  await bot.checkAndAnnounceStatus();
  assert.equal(state.calls.length, callCount, "a stable status does not create a duplicate announcement or make an unnecessary Discord API call");
});

test("welcome and server boost events post to their configured channels with safe member mentions", async () => {
  const { bot, state } = botFixture({
    channels: [
      { id: "610000000000000011", name: "welcome", type: 0 },
      { id: "610000000000000012", name: "server-boosts", type: 0 },
    ],
  });

  const welcomed = await bot.welcomeMember({ user: { id: memberId, username: "new-member", bot: false } });
  assert.equal(welcomed, true);
  const welcomePosts = () => state.calls.filter(call => call.path === "/channels/610000000000000011/messages" && call.method === "POST");
  assert.equal(welcomePosts().length, 1);
  assert.match(welcomePosts()[0].body.content, new RegExp("<@" + memberId + ">"));
  assert.deepEqual(welcomePosts()[0].body.allowed_mentions.users, [memberId]);
  assert.equal(bot.handleMemberRemove({ user: { id: memberId } }), true);
  assert.equal(await bot.welcomeMember({ user: { id: memberId, username: "returning-member", bot: false } }), true);
  assert.equal(welcomePosts().length, 2, "a member who leaves and rejoins receives a fresh welcome");

  bot.startedAt = Date.now() - 60_000;
  const newBoostAt = new Date(Date.now() - 30_000).toISOString();
  const firstBoost = await bot.handleMemberUpdate({ user: { id: targetId }, premium_since: newBoostAt });
  const secondUpdate = await bot.handleMemberUpdate({ user: { id: targetId }, premium_since: newBoostAt });
  assert.equal(firstBoost, true);
  assert.equal(secondUpdate, false);
  const boostPosts = state.calls.filter(call => call.path === "/channels/610000000000000012/messages" && call.method === "POST");
  assert.equal(boostPosts.length, 1);
  assert.equal(boostPosts[0].body.content, "Thanks <@" + targetId + "> for boosting the server!");
  assert.deepEqual(boostPosts[0].body.allowed_mentions.users, [targetId]);

  await bot.handleMemberUpdate({ user: { id: targetId }, premium_since: null });
  const reboost = await bot.handleMemberUpdate({ user: { id: targetId }, premium_since: new Date(Date.now() - 10_000).toISOString() });
  assert.equal(reboost, true);
  assert.equal(state.calls.filter(call => call.path === "/channels/610000000000000012/messages" && call.method === "POST").length, 2);
});

test("currently boosted members are seeded at gateway ready and do not receive a false new-boost thank-you", async () => {
  const { bot, state } = botFixture({
    channels: [{ id: "610000000000000012", name: "server-boosts", type: 0 }],
  });
  bot.startedAt = Date.now() - 60_000;
  const existingBoostAt = new Date(Date.now() - 30_000).toISOString();
  bot.seedKnownBoosters([{ user: { id: targetId }, premium_since: existingBoostAt }]);
  assert.equal(await bot.handleMemberUpdate({ user: { id: targetId }, premium_since: existingBoostAt }), false);
  assert.equal(state.calls.some(call => call.path.endsWith("/messages") && call.method === "POST"), false);
});

test("changelog command publishes a formatted entry to the existing changelog channel for authorised staff", async () => {
  const { bot, state } = botFixture({
    channels: [{ id: "610000000000000013", name: "changelog", type: 0 }],
  });
  const result = await bot.publishChangelog(interaction("snoozer-changelog", [
    { name: "title", value: "Studio improvements" },
    { name: "details", value: "The profile editor has been improved and several layout bugs have been fixed." },
  ], {
    member: {
      user: { id: moderatorId, username: "moderator" },
      permissions: String(1n << 13n),
      roles: [],
    },
  }));
  assert.match(result, /published in/);
  const post = state.calls.find(call => call.path === "/channels/610000000000000013/messages" && call.method === "POST");
  assert.ok(post);
  assert.equal(post.body.embeds[0].title, "Snoozer update · Studio improvements");
  assert.deepEqual(post.body.allowed_mentions.parse, []);
});

test("members without Manage Messages cannot publish changelog entries", async () => {
  const { bot } = botFixture({
    channels: [{ id: "610000000000000013", name: "changelog", type: 0 }],
  });
  await assert.rejects(bot.publishChangelog(interaction("snoozer-changelog", [
    { name: "title", value: "Studio improvements" },
    { name: "details", value: "The profile editor has been improved and several layout bugs have been fixed." },
  ])), /need Manage Messages/);
});

test("support ticket creates a private channel, notifies support and prevents duplicate open tickets", async () => {
  const roles = [
    { id: "610000000000000001", name: "Snoozer Admin" },
    { id: "610000000000000002", name: "Senior Moderator" },
    { id: "610000000000000003", name: "Moderator" },
    { id: "610000000000000004", name: "Support Team" },
    { id: "610000000000000005", name: "Support Manager" },
    { id: "610000000000000006", name: "Ticket Support" },
  ];
  const channels = [
    { id: "620000000000000001", name: "TICKETS", type: 4 },
    { id: "620000000000000002", name: "support-queue", type: 0 },
  ];
  const { bot, state } = botFixture({ roles, channels });
  const first = await bot.submitTicket(interaction("snoozer-ticket", [
    { name: "subject", value: "Cannot publish profile" },
    { name: "details", value: "The publish action returns an error after I save my profile." },
  ]));
  assert.match(first, /private support ticket has been created/);

  const ticket = state.channels.find(channel => channel.topic?.includes("SNOOZER_TICKET:v1"));
  assert.ok(ticket);
  const publicDeny = ticket.permission_overwrites.find(entry => entry.id === guildId && entry.type === 0);
  const ownerAllow = ticket.permission_overwrites.find(entry => entry.id === memberId && entry.type === 1);
  const supportAllow = ticket.permission_overwrites.find(entry => entry.id === "610000000000000004" && entry.type === 0);
  assert.equal(publicDeny.deny, "1024");
  assert.ok(BigInt(ownerAllow.allow) & (1n << 10n));
  assert.ok(BigInt(supportAllow.allow) & (1n << 10n));
  assert.ok(state.calls.some(call => call.path === "/channels/620000000000000002/messages" && call.method === "POST"));

  const createCount = state.calls.filter(call => call.path === "/guilds/" + guildId + "/channels" && call.method === "POST").length;
  const second = await bot.submitTicket(interaction("snoozer-ticket", [
    { name: "subject", value: "A second ticket" },
    { name: "details", value: "This should not create another open ticket for the same person." },
  ]));
  assert.match(second, /already have an open support ticket/);
  assert.equal(state.calls.filter(call => call.path === "/guilds/" + guildId + "/channels" && call.method === "POST").length, createCount);
});

test("ticket close is limited to the owner or staff and locks the owner's send permission", async () => {
  const ticketId = "630000000000000001";
  const channel = {
    id: ticketId,
    name: "ticket-community-member-555555",
    type: 0,
    topic: "SNOOZER_TICKET:v1 owner=" + memberId + " status=open created_at=2026-11-28T10:00:00.000Z",
    permission_overwrites: [
      { id: guildId, type: 0, allow: "0", deny: "1024" },
      { id: memberId, type: 1, allow: "117760", deny: "0" },
    ],
  };
  const { bot, state } = botFixture({
    channels: [channel],
    roles: [{ id: "610000000000000001", name: "Support Team" }],
  });
  const result = await bot.closeTicket(interaction("snoozer-ticket-close", [], {
    channel_id: ticketId,
  }));
  assert.equal(result, "The ticket has been closed.");
  const closed = state.channels.find(item => item.id === ticketId);
  assert.equal(closed.name, "closed-ticket-community-member-555555");
  assert.match(closed.topic, /status=closed/);
  const owner = closed.permission_overwrites.find(entry => entry.id === memberId && entry.type === 1);
  assert.equal(owner.deny, String(1n << 11n));
  assert.ok(state.calls.some(call => call.path === "/channels/" + ticketId + "/messages" && call.method === "POST"));
});


test("private member reports notify moderators but do not grant Support Team access", async () => {
  const roles = [
    { id: "610000000000000001", name: "Snoozer Admin" },
    { id: "610000000000000002", name: "Senior Moderator" },
    { id: "610000000000000003", name: "Moderator" },
    { id: "610000000000000004", name: "Support Team" },
  ];
  const channels = [
    { id: "620000000000000003", name: "STAFF HQ", type: 4 },
    { id: "620000000000000004", name: "moderation-log", type: 0 },
  ];
  const { bot, state } = botFixture({ roles, channels });
  const result = await bot.reportMember(interaction("snoozer-report", [
    { name: "user", value: targetId },
    { name: "reason", value: "Repeated harassment in community channels." },
  ]));
  assert.match(result, /private report has been sent/);

  const report = state.channels.find(channel => channel.topic?.includes("SNOOZER_REPORT:v1"));
  assert.ok(report);
  assert.equal(report.permission_overwrites.some(entry => entry.id === targetId && entry.type === 1), false);
  assert.ok(report.permission_overwrites.some(entry => entry.id === "610000000000000002" && entry.type === 0));
  assert.ok(report.permission_overwrites.some(entry => entry.id === "610000000000000003" && entry.type === 0));
  assert.equal(report.permission_overwrites.some(entry => entry.id === "610000000000000004"), false);

  const opening = state.messages.get(report.id)?.[0];
  assert.ok(opening);
  assert.ok(opening.content.includes("<@&610000000000000003>"));
  assert.deepEqual(opening.allowed_mentions.roles, ["610000000000000003"]);
  assert.equal(opening.content.includes("<@&610000000000000004>"), false);
});

test("staff timeout uses Discord's audit reason and records the action in moderation-log", async () => {
  const { bot, state } = botFixture({
    channels: [{ id: "640000000000000001", name: "moderation-log", type: 0 }],
  });
  await bot.handle(interaction("snoozer-timeout", [
    { name: "user", value: targetId },
    { name: "minutes", value: 15 },
    { name: "reason", value: "Repeated disruptive messages" },
  ], {
    member: {
      user: { id: moderatorId, username: "moderator" },
      permissions: String(1n << 40n),
      roles: [],
    },
  }));

  const timeout = state.calls.find(call => call.path === "/guilds/" + guildId + "/members/" + targetId && call.method === "PATCH");
  assert.ok(timeout);
  assert.ok(timeout.headers["X-Audit-Log-Reason"].includes("Repeated%20disruptive%20messages"));
  assert.match(timeout.body.communication_disabled_until, /^\d{4}-\d{2}-\d{2}T/);
  const log = state.calls.find(call => call.path === "/channels/640000000000000001/messages" && call.method === "POST");
  assert.ok(log);
  assert.match(log.body.embeds[0].description, /Repeated disruptive messages/);
});

test("members without the required Discord permission cannot run moderation actions", async () => {
  const { bot, state } = botFixture({
    channels: [{ id: "640000000000000001", name: "moderation-log", type: 0 }],
  });
  await bot.handle(interaction("snoozer-ban", [
    { name: "user", value: targetId },
    { name: "reason", value: "Repeated abusive behaviour" },
  ], {
    member: {
      user: { id: memberId, username: "member" },
      permissions: "0",
      roles: [],
    },
  }));
  assert.equal(state.calls.some(call => call.method === "PUT" && call.path.includes("/bans/")), false);
  assert.equal(state.calls.some(call => call.method === "DELETE" && call.path.includes("/members/")), false);
  assert.equal(state.calls.some(call => call.method === "PATCH" && call.path.includes("/members/")), false);
  const response = state.calls.find(call => call.path.includes("/webhooks/"));
  assert.match(response.body.content, /required for this moderation command/);
});


test("public feedback submissions are rate limited per member to prevent command spam", async () => {
  const { bot, state } = botFixture({
    channels: [{ id: "650000000000000001", name: "bug-reports", type: 0 }],
  });
  const request = interaction("snoozer-bug", [
    { name: "title", value: "Profile editor issue" },
    { name: "details", value: "Saving the profile editor returns an unexpected error." },
  ]);
  const first = await bot.submitPublicFeedback(request, "bug-reports", "bug");
  assert.match(first, /has been posted/);
  await assert.rejects(
    bot.submitPublicFeedback(request, "bug-reports", "bug"),
    /Please wait .* before sending another feedback/,
  );
  assert.equal(state.calls.filter(call => call.path === "/channels/650000000000000001/messages").length, 1);
});


test("concurrent ticket requests from one member cannot create duplicate private channels", async () => {
  const roles = [
    { id: "610000000000000001", name: "Snoozer Admin" },
    { id: "610000000000000002", name: "Senior Moderator" },
    { id: "610000000000000003", name: "Moderator" },
    { id: "610000000000000004", name: "Support Team" },
    { id: "610000000000000005", name: "Support Manager" },
    { id: "610000000000000006", name: "Ticket Support" },
  ];
  const channels = [{ id: "620000000000000001", name: "TICKETS", type: 4 }];
  const { bot, state } = botFixture({ roles, channels });
  const create = () => bot.submitTicket(interaction("snoozer-ticket", [
    { name: "subject", value: "Cannot update profile" },
    { name: "details", value: "The save button does not complete the profile update." },
  ]));
  const results = await Promise.allSettled([create(), create()]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(results.filter(result => result.status === "rejected").length, 1);
  assert.match(results.find(result => result.status === "rejected").reason.message, /already being opened/);
  assert.equal(state.channels.filter(channel => channel.topic?.includes("SNOOZER_TICKET:v1")).length, 1);
});

test("status announcements retry after Discord rejects a message instead of losing the transition", async () => {
  const { bot, api, state } = botFixture({
    channels: [{ id: "610000000000000001", name: "service-status", type: 0 }],
    fetcher: async () => new Response(JSON.stringify(statusSnapshot("outage")), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  });
  bot.statusBaseline = "operational";
  const original = api.request.bind(api);
  let rejected = false;
  api.request = async (path, options = {}) => {
    if (!rejected && path === "/channels/610000000000000001/messages" && options.method === "POST") {
      rejected = true;
      throw new Error("Discord rate limit");
    }
    return original(path, options);
  };
  await bot.checkAndAnnounceStatus();
  assert.equal(bot.statusBaseline, "operational", "failed notification must not advance the stored state");
  await bot.checkAndAnnounceStatus();
  assert.equal(bot.statusBaseline, "outage", "successful retry advances the status baseline");
  assert.equal(state.calls.filter(call => call.path === "/channels/610000000000000001/messages" && call.method === "POST").length, 1);
});

test("ticket creation remains usable when Discord rejects the opening message", async () => {
  const roles = [
    { id: "610000000000000001", name: "Snoozer Admin" },
    { id: "610000000000000002", name: "Senior Moderator" },
    { id: "610000000000000003", name: "Moderator" },
    { id: "610000000000000004", name: "Support Team" },
    { id: "610000000000000005", name: "Support Manager" },
    { id: "610000000000000006", name: "Ticket Support" },
  ];
  const channels = [{ id: "620000000000000001", name: "TICKETS", type: 4 }];
  const { bot, api, state } = botFixture({ roles, channels });
  const original = api.request.bind(api);
  api.request = async (path, options = {}) => {
    if (path.match(/^\/channels\/[0-9]+\/messages$/) && options.method === "POST") {
      throw new Error("message send unavailable");
    }
    return original(path, options);
  };
  const result = await bot.submitTicket(interaction("snoozer-ticket", [
    { name: "subject", value: "Account access" },
    { name: "details", value: "I cannot sign into the site using the normal flow." },
  ]));
  assert.match(result, /channel exists, but Discord rejected its opening message/);
  assert.ok(state.channels.some(channel => channel.topic?.includes("SNOOZER_TICKET:v1")));
});
