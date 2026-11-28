import { SETUP_COMPLETE_MARKER } from "./server-setup.mjs";

export const SNOOZER_ROLE_LAYOUT = [
  { key: "admin", name: "👑・Snoozer Admin", color: 0x8b72d9, hoist: true, permissions: ["manageGuild","manageChannels","manageRoles","manageEvents","manageWebhooks","viewAuditLog","manageMessages","kickMembers","banMembers","moderateMembers"] },
  { key: "senior_moderator", name: "🛡️・Senior Moderator", color: 0xb94b63, hoist: true, permissions: ["viewAuditLog","manageMessages","kickMembers","banMembers","moderateMembers"] },
  { key: "moderator", name: "🛡️・Moderator", color: 0xd65a68, hoist: true, permissions: ["viewAuditLog","manageMessages","kickMembers","banMembers","moderateMembers"] },
  { key: "community_manager", name: "💼・Community Manager", color: 0x438f9b, hoist: true, permissions: ["manageMessages"] },
  { key: "support_manager", name: "🎧・Support Manager", color: 0x397fba, hoist: true, permissions: [] },
  { key: "support_team", name: "🎧・Support Team", color: 0x4d91c9, hoist: true, permissions: [] },
  { key: "ticket_support", name: "🎫・Ticket Support", color: 0x69a8d7, hoist: true, permissions: [] },
  { key: "developer", name: "💻・Developer", color: 0x35a79b, hoist: true, permissions: [] },
  { key: "event_host", name: "🎙️・Event Host", color: 0xc27b42, hoist: true, permissions: [] },
  { key: "community_helper", name: "🤝・Community Helper", color: 0x72a68e, hoist: true, permissions: [] },
  { key: "premium", name: "💎・Premium", color: 0xc69a43, hoist: true, permissions: [] },
  { key: "creator", name: "✨・Creator", color: 0x64a982, hoist: true, permissions: [] },
  { key: "member", name: "👤・Member", color: 0x7a8493, hoist: false, permissions: [] },
  { key: "bots", name: "🤖・Bots", color: 0x596579, hoist: false, permissions: [] },
  { key: "booster", name: "🚀・Server Booster", color: 0xf47fff, hoist: true, permissions: [] },
  { key: "notify_updates", name: "🔔・Snoozer Updates", color: 0x438f9b, hoist: false, permissions: [] },
  { key: "notify_events", name: "📅・Community Events", color: 0xc27b42, hoist: false, permissions: [] },
  { key: "notify_giveaways", name: "🎉・Giveaways", color: 0xc69a43, hoist: false, permissions: [] },
];

const readOnly = (key,name,topic) => ({ key,name,type:"text",topic,mode:"readonly" });
const publicChat = (key,name,topic) => ({ key,name,type:"text",topic,mode:"chat" });
const staffChat = (key,name,topic) => ({ key,name,type:"text",topic,mode:"staff" });
const internalChat = (key,name,topic) => ({ key,name,type:"text",topic,mode:"internal" });
const voice = (key,name,topic) => ({ key,name,type:"voice",topic,mode:"voice" });

export const SNOOZER_SERVER_LAYOUT = [
  {
    key:"start_here", name:"✦・𝗦𝗧𝗔𝗥𝗧 𝗛𝗘𝗥𝗘", visibility:"public",
    channels:[
      readOnly("welcome","👋・welcome","Welcome to the official Snoozer community. New members receive a private-safe welcome here."),
      readOnly("rules","📜・rules","Read the Snoozer community rules before participating."),
      readOnly("announcements","📢・announcements","Official Snoozer announcements and important community notices."),
      readOnly("getting_started","🧭・getting-started","An interactive guide to Snoozer, the website and the community."),
      readOnly("member_hub","🪪・member-hub","Interactive account linking, profile, Premium, creator and self-service role panel."),
      readOnly("faq","❔・faq","Common questions and official Snoozer resources."),
    ],
  },
  {
    key:"updates", name:"✦・𝗦𝗡𝗢𝗢𝗭𝗘𝗥 𝗨𝗣𝗗𝗔𝗧𝗘𝗦", visibility:"public",
    channels:[
      readOnly("changelog","📰・changelog","Automated official Snoozer product release notes."),
      readOnly("service_status","🟢・service-status","Live Snoozer service health, incident and recovery announcements."),
      readOnly("roadmap","🗺️・roadmap","Snoozer product roadmap and planned improvements."),
      readOnly("maintenance_log","🛠️・maintenance-log","Planned maintenance windows and completion notices."),
      readOnly("goodbye","👋・goodbye","A short message when a member leaves the Snoozer community."),
    ],
  },
  {
    key:"community", name:"✦・𝗖𝗢𝗠𝗠𝗨𝗡𝗜𝗧𝗬", visibility:"public",
    channels:[
      publicChat("general","💬・general","Main Snoozer community discussion. Keep conversations constructive."),
      publicChat("introductions","🙋・introductions","Introduce yourself and tell the community what you are building."),
      publicChat("creator_showcase","🎨・creator-showcase","Share your Snoozer profile, projects and creative work."),
      publicChat("off_topic","💤・off-topic","Friendly conversation outside the main Snoozer topics."),
      readOnly("server_boosts","🚀・server-boosts","Thank-you messages for community boosters and milestones."),
      readOnly("polls_votes","📊・polls-and-votes","Community polls and published voting panels."),
      publicChat("suggestions","💡・suggestions","Submit and vote on Snoozer feature suggestions."),
      readOnly("giveaways","🎉・giveaways","Official community giveaways and winner announcements."),
      readOnly("events","📅・events","Community events, scheduled activities and reminders."),
      voice("community_lounge","🔊・community-lounge","Open voice room for community conversation."),
      voice("creator_hangout","🎙️・creator-hangout","Voice room for creators and profile feedback."),
      voice("community_stage","🎤・community-stage","Community talks, presentations and hosted events."),
    ],
  },
  {
    key:"support", name:"✦・𝗦𝗨𝗣𝗣𝗢𝗥𝗧 𝗗𝗘𝗦𝗞", visibility:"public",
    channels:[
      readOnly("ticket_panel","🎫・open-a-ticket","Use the interactive panel to open a private support ticket. Never post passwords or payment details."),
      publicChat("bug_reports","🐛・bug-reports","Report reproducible bugs without sharing private account information."),
      readOnly("help_centre","📚・help-centre","Official Help Centre guidance and links for account or billing support."),
      readOnly("support_updates","🔔・support-updates","Non-sensitive support announcements and known issue updates."),
    ],
  },
  {
    key:"tickets", name:"🔒・𝗧𝗜𝗖𝗞𝗘𝗧𝗦", visibility:"private",
    channels:[],
  },
  {
    key:"team_hq", name:"✦・𝗧𝗘𝗔𝗠 𝗛𝗤", visibility:"staff",
    channels:[
      staffChat("staff_chat","💬・staff-chat","Private staff coordination."),
      staffChat("ticket_queue","🎫・ticket-queue","Staff ticket queue and assignment controls."),
      staffChat("moderation_log","🛡️・moderation-log","Recorded Discord moderation actions and case events."),
      staffChat("appeals_queue","⚖️・appeals-queue","Member appeals awaiting staff decisions."),
      staffChat("staff_notes","📝・staff-notes","Restricted internal notes. Do not store credentials or payment card details."),
      staffChat("security_alerts","🚨・security-alerts","Anti-raid, anti-nuke and dangerous administrator-action alerts."),
      staffChat("bot_control","⚙️・bot-control","Interactive Snoozer bot administration dashboard."),
      voice("staff_room","🔒・staff-room","Private staff voice room."),
    ],
  },
  {
    key:"internal", name:"✦・𝗜𝗡𝗧𝗘𝗥𝗡𝗔𝗟", visibility:"internal",
    channels:[
      internalChat("setup_state","snoozer-setup-state",SETUP_COMPLETE_MARKER+" | This private channel stores the one-time setup completion marker. Do not delete it."),
      staffChat("bot_logs","📡・bot-logs","Internal bot diagnostics and structured events."),
      staffChat("health_monitor","💓・health-monitor","Gateway, worker, queue and dependency health."),
      staffChat("backup_registry","🗄️・backup-registry","Server configuration backup records."),
      staffChat("automation_queue","📋・automation-queue","Scheduled jobs and automation failures."),
    ],
  },
  {
    key:"voice_rooms", name:"✦・𝗩𝗢𝗜𝗖𝗘 𝗥𝗢𝗢𝗠𝗦", visibility:"public",
    channels:[
      voice("staff_voice","🔒・staff-voice","Private voice room for authorised staff."),
    ],
  },
];

export const SNOOZER_RESOURCE_KEYS = [
  { key:"guild", type:"category", name:"Snoozer Discord Guild" },
  ...SNOOZER_ROLE_LAYOUT.map(role=>({key:"role_"+role.key,type:"role",name:role.name})),
  ...SNOOZER_SERVER_LAYOUT.flatMap(category=>[
    {key:"category_"+category.key,type:"category",name:category.name},
    ...category.channels.map(channel=>({key:channel.key,type:channel.type==="voice"?"voice":"text",name:channel.name})),
  ]),
];

export const LEGACY_ROLE_NAMES = new Map([
  ["snoozer admin","admin"],["senior moderator","senior_moderator"],["moderator","moderator"],
  ["community manager","community_manager"],["support manager","support_manager"],
  ["support team","support_team"],["ticket support","ticket_support"],["developer","developer"],
  ["event host","event_host"],["community helper","community_helper"],["premium","premium"],
  ["creator","creator"],["member","member"],["bots","bots"],
]);

export const SNOOZER_PANEL_KEYS = ["getting_started","member_hub","ticket_panel","bot_control"];
