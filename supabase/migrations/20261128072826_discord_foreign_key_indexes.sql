create index if not exists discord_bot_appeals_case_id_idx
  on snoozer.discord_bot_appeals(case_id);
create index if not exists discord_bot_creator_verifications_owner_id_idx
  on snoozer.discord_bot_creator_verifications(owner_id);
create index if not exists discord_bot_tickets_owner_user_id_idx
  on snoozer.discord_bot_tickets(owner_user_id);
