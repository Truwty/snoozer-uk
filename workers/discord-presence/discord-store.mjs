const DEFAULT_TIMEOUT_MS = 8_000;
const SNOWFLAKE = /^[1-9][0-9]{16,19}$/;

export class DiscordStore {
  constructor(config, dependencies = {}) {
    this.url = String(config.url ?? "").replace(/\/+$/, "");
    this.key = config.serviceKey ?? "";
    this.fetcher = dependencies.fetcher ?? globalThis.fetch;
    this.timeoutMs = dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!/^https:\/\/[a-z0-9.-]+$/i.test(this.url) || !this.key) {
      throw new Error("Discord persistent storage is not configured. Check the Supabase URL and service-role key on the existing Render service.");
    }
  }

  async rpc(name, args = {}) {
    if (!/^[a-z][a-z0-9_]{1,100}$/.test(name)) throw new Error("Invalid internal Discord RPC name.");
    const response = await this.fetcher(this.url + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: {
        apikey: this.key,
        Authorization: "Bearer " + this.key,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Content-Profile": "public",
        "Accept-Profile": "public",
      },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const body = await response.text();
    if (!response.ok) {
      let failure = null;
      try { failure = body ? JSON.parse(body) : null; } catch { failure = { message: body }; }
      const detail = [failure?.code, failure?.message, failure?.details, failure?.hint]
        .filter(value => typeof value === "string" && value.trim())
        .join(" · ")
        .replace(/[\\u0000-\\u001f\\u007f]/g, " ")
        .slice(0, 600);
      throw new Error("Discord storage operation " + name + " failed with HTTP " + response.status
        + (detail ? " (" + detail + ")" : "") + ".");
    }
    if (!body) return null;
    try { return JSON.parse(body); } catch { throw new Error("Discord storage returned invalid JSON for " + name + "."); }
  }

  registerResources(guildId, resources) {
    if (!SNOWFLAKE.test(guildId) || !Array.isArray(resources)) throw new Error("Invalid Discord resource registry input.");
    return this.rpc("discord_bot_register_resources", { p_guild_id:guildId, p_resources:resources });
  }

  async getResources(guildId) {
    const rows = await this.rpc("discord_bot_get_resources", { p_guild_id:guildId });
    const resources = Array.isArray(rows) ? rows : [];
    const map = Object.create(null);
    for (const row of resources) {
      if (!row || typeof row.resource_key!=="string" || !SNOWFLAKE.test(row.discord_id)) continue;
      map[row.resource_key] = row.discord_id;
    }
    return { rows:resources, map };
  }

  saveBackup(guildId, actorId, snapshot) {
    return this.rpc("discord_bot_save_backup", { p_guild_id:guildId,p_actor:actorId,p_snapshot:snapshot });
  }

  openTicket(input) {
    return this.rpc("discord_bot_open_ticket", {
      p_guild_id:input.guildId,p_channel_id:input.channelId,p_owner_discord_id:input.ownerId,
      p_category:input.category,p_subject:input.subject,p_details:input.details,
    });
  }

  ticketAction(ticketId, actorId, action, payload = {}) {
    return this.rpc("discord_bot_ticket_action", { p_ticket_id:ticketId,p_actor:actorId,p_action:action,p_payload:payload });
  }

  ticketQueue(guildId, limit = 50) {
    return this.rpc("discord_bot_ticket_queue", { p_guild_id:guildId,p_limit:limit });
  }

  getTicket(id) { return this.rpc("discord_bot_ticket_get", { p_ticket_id:id }); }
  ticketStatistics(guildId) { return this.rpc("discord_bot_ticket_statistics", { p_guild_id:guildId }); }
  reviewSubmission(id,actorId,decision,note=null) {
    return this.rpc("discord_bot_submission_review", { p_id:id,p_actor:actorId,p_decision:decision,p_note:note });
  }

  createCase(input) {
    return this.rpc("discord_bot_create_case", {
      p_guild_id:input.guildId,p_target:input.targetId,p_moderator:input.moderatorId,
      p_action:input.action,p_reason:input.reason,p_duration_seconds:input.durationSeconds ?? null,
      p_warning_points:input.warningPoints ?? 0,p_metadata:input.metadata ?? {},
    });
  }

  caseHistory(guildId,targetId,limit=25) {
    return this.rpc("discord_bot_case_history", { p_guild_id:guildId,p_target:targetId,p_limit:limit });
  }


  appealQueue(guildId,limit=25) {
    return this.rpc("discord_bot_appeal_queue", { p_guild_id:guildId,p_limit:limit });
  }
  reviewAppeal(id,reviewerId,decision,response=null) {
    return this.rpc("discord_bot_review_appeal", { p_appeal_id:id,p_reviewer:reviewerId,p_decision:decision,p_response:response });
  }

  createAppeal(caseId,appellantId,reason) {
    return this.rpc("discord_bot_create_appeal", { p_case_id:caseId,p_appellant:appellantId,p_reason:reason });
  }

  creatorRequest(discordUserId,profileUrl,reason) {
    return this.rpc("discord_bot_creator_request", { p_discord_user_id:discordUserId,p_profile_url:profileUrl,p_reason:reason });
  }

  creatorReview(requestId,reviewerId,decision,note) {
    return this.rpc("discord_bot_creator_review", { p_request_id:requestId,p_reviewer:reviewerId,p_decision:decision,p_note:note ?? null });
  }

  createSubmission(input) {
    return this.rpc("discord_bot_submission_create", {
      p_guild_id:input.guildId,p_kind:input.kind,p_author:input.authorId,
      p_title:input.title,p_body:input.body,p_metadata:input.metadata ?? {},
    });
  }

  voteSubmission(id,voterId,choice="up") {
    return this.rpc("discord_bot_submission_vote", { p_id:id,p_voter:voterId,p_choice:choice });
  }

  pollResults(id) {
    return this.rpc("discord_bot_poll_results", { p_id:id });
  }

  memberSummary(discordUserId) {
    if (!SNOWFLAKE.test(discordUserId)) throw new Error("Invalid Discord user ID.");
    return this.rpc("discord_bot_member_summary", { p_discord_user_id:discordUserId });
  }

  roleSyncTargets(guildId) {
    return this.rpc("discord_bot_role_sync_targets", { p_guild_id:guildId });
  }

  claimJobs(guildId,limit=20) {
    return this.rpc("discord_bot_claim_jobs", { p_guild_id:guildId,p_limit:limit });
  }

  enqueueJob(input) {
    return this.rpc("discord_bot_enqueue_job", {
      p_guild_id:input.guildId,p_job_type:input.jobType,p_dedupe_key:input.dedupeKey,
      p_payload:input.payload??{},p_run_at:input.runAt??new Date().toISOString(),
    });
  }

  finishJob(id,success,error=null) {
    return this.rpc("discord_bot_finish_job", { p_id:id,p_success:success,p_error:error });
  }

  getConfig(guildId) {
    return this.rpc("discord_bot_config_get", { p_guild_id:guildId });
  }

  setConfig(guildId,key,config) {
    return this.rpc("discord_bot_config_set", { p_guild_id:guildId,p_key:key,p_config:config });
  }


  recordSecurityEvent(input) {
    return this.rpc("discord_bot_record_security_event", {
      p_guild_id:input.guildId,p_action:input.action,p_actor:input.actorId??null,
      p_target:input.targetId??null,p_severity:input.severity??"warning",p_metadata:input.metadata??{},
    });
  }
  pruneBackups(guildId,keep=30) {
    return this.rpc("discord_bot_prune_backups", { p_guild_id:guildId,p_keep:keep });
  }
  latestBackup(guildId) { return this.rpc("discord_bot_latest_backup", { p_guild_id:guildId }); }
  creatorQueue(limit=25) { return this.rpc("discord_bot_creator_queue", { p_limit:limit }); }
  activeWarningPoints(guildId,targetId) { return this.rpc("discord_bot_active_warning_points", { p_guild_id:guildId,p_target:targetId }); }
  activityIncrement(guildId,userId,messages=0,voiceMinutes=0) {
    return this.rpc("discord_bot_activity_increment", { p_guild_id:guildId,p_user:userId,p_messages:messages,p_voice_minutes:voiceMinutes });
  }
  activityLeaderboard(guildId,days=30,limit=25) {
    return this.rpc("discord_bot_activity_leaderboard", { p_guild_id:guildId,p_days:days,p_limit:limit });
  }
  createScheduledEvent(input) {
    return this.rpc("discord_bot_create_scheduled_event", {
      p_guild_id:input.guildId,p_discord_event_id:input.discordEventId,p_channel_id:input.channelId??null,
      p_actor:input.actorId,p_name:input.name,p_description:input.description,p_starts_at:input.startsAt,p_ends_at:input.endsAt,
    });
  }
  scheduledEventQueue(guildId,limit=25) { return this.rpc("discord_bot_scheduled_event_queue", { p_guild_id:guildId,p_limit:limit }); }
  createGiveaway(input) {
    return this.rpc("discord_bot_create_giveaway", {
      p_guild_id:input.guildId,p_channel_id:input.channelId,p_title:input.title,p_prize:input.prize,
      p_winner_count:input.winnerCount,p_ends_at:input.endsAt,p_minimum_role_id:input.minimumRoleId??null,p_actor:input.actorId,
    });
  }
  enterGiveaway(id,userId,eligible=true) { return this.rpc("discord_bot_giveaway_enter", { p_id:id,p_user:userId,p_eligible:eligible }); }
  finishGiveaway(id) { return this.rpc("discord_bot_finish_giveaway", { p_id:id }); }

  interactionStats(days=30,limit=25) { return this.rpc('discord_bot_interaction_usage',{p_days:days,p_limit:limit}); }

  recordInteraction(interactionId,interactionType) {
    return this.rpc("discord_bot_record_interaction", { p_id:interactionId,p_type:interactionType });
  }
}
