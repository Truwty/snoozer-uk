-- Support owner-scoped cache pruning and FK cascades for Discord presence events.
create index if not exists discord_presence_events_discord_user_id
  on snoozer.discord_presence_events(discord_user_id);
