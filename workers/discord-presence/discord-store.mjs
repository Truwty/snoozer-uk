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
      throw new Error("Discord storage operation " + name + " failed with HTTP " + response.status + ".");
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

  recordInteraction(interactionId,interactionType) {
    return this.rpc("discord_bot_record_interaction", { p_id:interactionId,p_type:interactionType });
  }
}
