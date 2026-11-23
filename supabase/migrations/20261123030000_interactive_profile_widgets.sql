begin;

create function snoozer.valid_profile_widgets(p_value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare item jsonb;
declare entry_count integer;
declare unique_count integer;
declare target timestamptz;
declare default_value constant jsonb := '{"version":1,"order":["guestbook","testimonials","poll","faq"],"guestbook":{"enabled":false,"heading":"Guestbook","description":"Leave a message.","maxEntries":10,"submissionsOpen":true},"testimonials":{"enabled":false,"heading":"Testimonials","items":[]},"poll":{"enabled":false,"id":"00000000-0000-4000-8000-000000000001","question":"","options":[],"open":true,"closesAt":null,"showResultsBeforeVote":false},"faq":{"enabled":false,"heading":"Frequently asked questions","items":[]}}'::jsonb;
begin
  -- Existing profiles receive this explicit safe default during the additive migration.
  if p_value = default_value then return true; end if;
  if jsonb_typeof(p_value) is distinct from 'object'
    or p_value - array['version','order','guestbook','testimonials','poll','faq'] <> '{}'::jsonb
    or p_value->>'version' is distinct from '1'
    or jsonb_typeof(p_value->'order') is distinct from 'array'
    or jsonb_array_length(p_value->'order') <> 4
    or jsonb_typeof(p_value->'guestbook') is distinct from 'object'
    or jsonb_typeof(p_value->'testimonials') is distinct from 'object'
    or jsonb_typeof(p_value->'poll') is distinct from 'object'
    or jsonb_typeof(p_value->'faq') is distinct from 'object'
  then return false; end if;

  select count(*),count(distinct value) into entry_count,unique_count
    from jsonb_array_elements_text(p_value->'order');
  if entry_count <> 4 or unique_count <> 4 or exists (
    select 1 from jsonb_array_elements_text(p_value->'order') x(value)
    where x.value not in ('guestbook','testimonials','poll','faq')
  ) then return false; end if;

  if p_value->'guestbook' - array['enabled','heading','description','maxEntries','submissionsOpen'] <> '{}'::jsonb
    or jsonb_typeof(p_value->'guestbook'->'enabled') is distinct from 'boolean'
    or jsonb_typeof(p_value->'guestbook'->'heading') is distinct from 'string'
    or char_length(btrim(p_value->'guestbook'->>'heading')) not between 1 and 80
    or jsonb_typeof(p_value->'guestbook'->'description') is distinct from 'string'
    or char_length(p_value->'guestbook'->>'description') > 240
    or jsonb_typeof(p_value->'guestbook'->'maxEntries') is distinct from 'number'
    or (p_value->'guestbook'->>'maxEntries') !~ '^[0-9]{1,2}$'
    or (p_value->'guestbook'->>'maxEntries')::integer not between 1 and 10
    or jsonb_typeof(p_value->'guestbook'->'submissionsOpen') is distinct from 'boolean'
  then return false; end if;

  if p_value->'testimonials' - array['enabled','heading','items'] <> '{}'::jsonb
    or jsonb_typeof(p_value->'testimonials'->'enabled') is distinct from 'boolean'
    or jsonb_typeof(p_value->'testimonials'->'heading') is distinct from 'string'
    or char_length(btrim(p_value->'testimonials'->>'heading')) not between 1 and 80
    or jsonb_typeof(p_value->'testimonials'->'items') is distinct from 'array'
    or jsonb_array_length(p_value->'testimonials'->'items') > 6
    or ((p_value->'testimonials'->>'enabled')::boolean and jsonb_array_length(p_value->'testimonials'->'items') < 1)
  then return false; end if;
  for item in select value from jsonb_array_elements(p_value->'testimonials'->'items') loop
    if jsonb_typeof(item) is distinct from 'object'
      or item - array['id','quote','author','role'] <> '{}'::jsonb
      or coalesce(item->>'id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      or jsonb_typeof(item->'quote') is distinct from 'string'
      or char_length(btrim(item->>'quote')) not between 1 and 500
      or jsonb_typeof(item->'author') is distinct from 'string'
      or char_length(btrim(item->>'author')) not between 1 and 80
      or (item ? 'role' and (jsonb_typeof(item->'role') is distinct from 'string' or char_length(item->>'role') > 80))
    then return false; end if;
  end loop;

  if p_value->'poll' - array['enabled','id','question','options','open','closesAt','showResultsBeforeVote'] <> '{}'::jsonb
    or jsonb_typeof(p_value->'poll'->'enabled') is distinct from 'boolean'
    or coalesce(p_value->'poll'->>'id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    or jsonb_typeof(p_value->'poll'->'question') is distinct from 'string'
    or char_length(p_value->'poll'->>'question') > 180
    or jsonb_typeof(p_value->'poll'->'options') is distinct from 'array'
    or jsonb_array_length(p_value->'poll'->'options') > 6
    or jsonb_typeof(p_value->'poll'->'open') is distinct from 'boolean'
    or (p_value->'poll' ? 'closesAt' and jsonb_typeof(p_value->'poll'->'closesAt') not in ('string','null'))
    or jsonb_typeof(p_value->'poll'->'showResultsBeforeVote') is distinct from 'boolean'
    or ((p_value->'poll'->>'enabled')::boolean and (
      char_length(btrim(p_value->'poll'->>'question')) not between 5 and 180
      or jsonb_array_length(p_value->'poll'->'options') not between 2 and 6
    ))
  then return false; end if;
  if p_value->'poll'->'closesAt' is distinct from 'null'::jsonb then
    if jsonb_typeof(p_value->'poll'->'closesAt') is distinct from 'string'
      or (p_value->'poll'->>'closesAt') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$' then
      return false;
    end if;
    begin
      target := (p_value->'poll'->>'closesAt')::timestamptz;
    exception when others then
      return false;
    end;
  end if;
  for item in select value from jsonb_array_elements(p_value->'poll'->'options') loop
    if jsonb_typeof(item) is distinct from 'object'
      or item - array['id','label'] <> '{}'::jsonb
      or coalesce(item->>'id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      or jsonb_typeof(item->'label') is distinct from 'string'
      or char_length(item->>'label') > 80
      or ((p_value->'poll'->>'enabled')::boolean and char_length(btrim(item->>'label')) not between 1 and 80)
    then return false; end if;
  end loop;
  select count(*),count(distinct value->>'id') into entry_count,unique_count from jsonb_array_elements(p_value->'poll'->'options');
  if entry_count <> unique_count then return false; end if;

  if p_value->'faq' - array['enabled','heading','items'] <> '{}'::jsonb
    or jsonb_typeof(p_value->'faq'->'enabled') is distinct from 'boolean'
    or jsonb_typeof(p_value->'faq'->'heading') is distinct from 'string'
    or char_length(btrim(p_value->'faq'->>'heading')) not between 1 and 80
    or jsonb_typeof(p_value->'faq'->'items') is distinct from 'array'
    or jsonb_array_length(p_value->'faq'->'items') > 10
    or ((p_value->'faq'->>'enabled')::boolean and jsonb_array_length(p_value->'faq'->'items') < 1)
  then return false; end if;
  for item in select value from jsonb_array_elements(p_value->'faq'->'items') loop
    if jsonb_typeof(item) is distinct from 'object'
      or item - array['id','question','answer'] <> '{}'::jsonb
      or coalesce(item->>'id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      or jsonb_typeof(item->'question') is distinct from 'string'
      or char_length(btrim(item->>'question')) not between 1 and 120
      or jsonb_typeof(item->'answer') is distinct from 'string'
      or char_length(btrim(item->>'answer')) not between 1 and 1000
    then return false; end if;
  end loop;
  select count(*),count(distinct value->>'id') into entry_count,unique_count from jsonb_array_elements(p_value->'faq'->'items');
  if entry_count <> unique_count then return false; end if;
  select count(*),count(distinct value->>'id') into entry_count,unique_count from jsonb_array_elements(p_value->'testimonials'->'items');
  if entry_count <> unique_count then return false; end if;
  return true;
exception when others then return false;
end $;
revoke execute on function snoozer.valid_profile_widgets(jsonb) from public,anon,authenticated,service_role;

alter table snoozer.profiles add column widgets jsonb not null default
'{"version":1,"order":["guestbook","testimonials","poll","faq"],"guestbook":{"enabled":false,"heading":"Guestbook","description":"Leave a message.","maxEntries":10,"submissionsOpen":true},"testimonials":{"enabled":false,"heading":"Testimonials","items":[]},"poll":{"enabled":false,"id":"00000000-0000-4000-8000-000000000001","question":"","options":[],"open":true,"closesAt":null,"showResultsBeforeVote":false},"faq":{"enabled":false,"heading":"Frequently asked questions","items":[]}}'::jsonb
check (snoozer.valid_profile_widgets(widgets));
alter table snoozer.published_profiles add column widgets jsonb not null default
'{"version":1,"order":["guestbook","testimonials","poll","faq"],"guestbook":{"enabled":false,"heading":"Guestbook","description":"Leave a message.","maxEntries":10,"submissionsOpen":true},"testimonials":{"enabled":false,"heading":"Testimonials","items":[]},"poll":{"enabled":false,"id":"00000000-0000-4000-8000-000000000001","question":"","options":[],"open":true,"closesAt":null,"showResultsBeforeVote":false},"faq":{"enabled":false,"heading":"Frequently asked questions","items":[]}}'::jsonb
check (snoozer.valid_profile_widgets(widgets));

-- Reuse the existing account inbox for a generic, non-sensitive moderation notice.
alter table snoozer.account_notifications drop constraint if exists account_notifications_kind_check;
alter table snoozer.account_notifications add constraint account_notifications_kind_check
  check(kind in ('restriction','reinstatement','premium_granted','premium_revoked','appeal_review','guestbook_message'));

create function snoozer.copy_profile_widgets_to_publication() returns trigger
language plpgsql security definer set search_path = '' as $
declare snapshot_widgets jsonb;
begin
  select p.widgets into snapshot_widgets from snoozer.profiles p
    where p.id = new.profile_id and p.owner_id = new.owner_id;
  if snapshot_widgets is null then raise exception 'Profile widget snapshot unavailable' using errcode = '23503'; end if;
  new.widgets := snapshot_widgets;
  return new;
end $;
revoke execute on function snoozer.copy_profile_widgets_to_publication() from public,anon,authenticated,service_role;
create trigger published_profile_widgets_snapshot before insert on snoozer.published_profiles
for each row execute function snoozer.copy_profile_widgets_to_publication();

create function public.save_profile(
 p_profile uuid, p_expected integer, p_name text, p_bio text, p_theme text, p_indexable boolean,
 p_links jsonb, p_publish boolean, p_remove_avatar boolean, p_sections jsonb,
 p_appearance jsonb, p_seo jsonb, p_widgets jsonb
) returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.verified_user();
declare saved integer;
begin
 if not snoozer.valid_profile_widgets(p_widgets) then raise exception 'Invalid profile widgets' using errcode='22023'; end if;
 update snoozer.profiles set widgets=p_widgets
   where id=p_profile and owner_id=actor and revision=p_expected;
 if not found then raise exception 'Profile revision conflict' using errcode='40001'; end if;
 saved := public.save_profile(p_profile,p_expected,p_name,p_bio,p_theme,p_indexable,
   p_links,p_publish,p_remove_avatar,p_sections,p_appearance,p_seo);
 return saved;
end $$;
revoke execute on function public.save_profile(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_profile(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb,jsonb,jsonb) to authenticated;

alter function snoozer.profile_draft(uuid) rename to profile_draft_without_widgets;
create function snoozer.profile_draft(p_profile uuid) returns jsonb
language sql stable set search_path='' as $$
 select snoozer.profile_draft_without_widgets(p.id) || jsonb_build_object('widgets',p.widgets)
 from snoozer.profiles p where p.id=p_profile
$$;
revoke execute on function snoozer.profile_draft(uuid),snoozer.profile_draft_without_widgets(uuid) from public,anon,authenticated,service_role;

alter function snoozer.profile_snapshot(uuid,integer,boolean) rename to profile_snapshot_without_widgets;
create function snoozer.profile_snapshot(p_profile uuid,p_revision integer,p_public boolean) returns jsonb
language sql stable set search_path='' as $$
 select snoozer.profile_snapshot_without_widgets(p_profile,p_revision,p_public) || jsonb_build_object('widgets',v.widgets)
 from snoozer.published_profiles v where v.profile_id=p_profile and v.revision=p_revision
$$;
revoke execute on function snoozer.profile_snapshot(uuid,integer,boolean),snoozer.profile_snapshot_without_widgets(uuid,integer,boolean) from public,anon,authenticated,service_role;

create or replace function public.restore_publication(p_profile uuid,p_revision integer,p_expected integer) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform snoozer.restore_profile_sections_for_id(p_profile,p_revision,p_expected);
  update snoozer.gallery_items set position=null where profile_id=p_profile and position is not null;
  with visible_items as (
    select g.id,row_number() over (order by s.position) as position
    from snoozer.published_gallery s join snoozer.gallery_items g
      on g.profile_id=s.profile_id and g.id=s.item
    where s.profile_id=p_profile and s.revision=p_revision and g.blocked_at is null
  )
  update snoozer.gallery_items g set position=v.position from visible_items v
    where g.profile_id=p_profile and g.id=v.id;
  update snoozer.profiles p set appearance=v.appearance,seo_title=v.seo_title,
    seo_description=v.seo_description,widgets=v.widgets
    from snoozer.published_profiles v
    where p.id=p_profile and v.profile_id=p_profile and v.revision=p_revision
      and p.owner_id=snoozer.verified_user();
  if not found then raise exception 'Publication unavailable' using errcode='42501'; end if;
end $$;

create table snoozer.guestbook_entries (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references snoozer.profiles(id) on delete cascade,
 display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
 message text not null check (char_length(btrim(message)) between 3 and 500),
 visitor_hash text not null check (visitor_hash ~ '^[0-9a-f]{64}$'),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 moderated_at timestamptz
);
create index guestbook_profile_status_time on snoozer.guestbook_entries(profile_id,status,created_at desc);
create index guestbook_profile_visitor_time on snoozer.guestbook_entries(profile_id,visitor_hash,created_at desc);
alter table snoozer.guestbook_entries enable row level security;
revoke all on snoozer.guestbook_entries from public,anon,authenticated,service_role;

create table snoozer.poll_votes (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references snoozer.profiles(id) on delete cascade,
 poll_id uuid not null,
 option_id uuid not null,
 visitor_hash text not null check (visitor_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(),
 unique(profile_id,poll_id,visitor_hash)
);
create index poll_votes_profile_time on snoozer.poll_votes(profile_id,created_at desc);
alter table snoozer.poll_votes enable row level security;
revoke all on snoozer.poll_votes from public,anon,authenticated,service_role;

create function public.get_public_guestbook_entries(p_username text,p_limit integer default 10) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',items.id,'displayName',items.display_name,
   'message',items.message,'createdAt',items.created_at) order by items.created_at asc),'[]'::jsonb)
 from (
   select e.id,e.display_name,e.message,e.created_at
   from snoozer.profiles p join snoozer.published_profiles v
     on v.profile_id=p.id and v.revision=p.published_revision
   join snoozer.guestbook_entries e on e.profile_id=p.id and e.status='approved'
   where p.username=p_username and p.published_revision is not null
     and v.widgets->'guestbook'->>'enabled'='true'
   order by e.created_at desc limit greatest(1,least(coalesce(p_limit,10),10))
 ) items
$$;

create function public.submit_profile_guestbook_entry(
 p_username text,p_display_name text,p_message text,p_visitor_hash text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_profile_id uuid;
declare entry_id uuid;
begin
 if p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 80
   or p_message is null or char_length(btrim(p_message)) not between 3 and 500
   or p_visitor_hash is null or p_visitor_hash !~ '^[0-9a-f]{64}$' then
   raise exception 'Invalid guestbook submission' using errcode='22023';
 end if;
 select p.id into v_profile_id
 from snoozer.profiles p join snoozer.published_profiles v
   on v.profile_id=p.id and v.revision=p.published_revision
 where p.username=p_username and p.published_revision is not null
   and v.widgets->'guestbook'->>'enabled'='true'
   and v.widgets->'guestbook'->>'submissionsOpen'='true';
 if v_profile_id is null then raise exception 'Guestbook is unavailable' using errcode='P2011'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_profile_id::text||':'||p_visitor_hash,0));
 if (select count(*) from snoozer.guestbook_entries e where e.profile_id=v_profile_id
     and e.visitor_hash=p_visitor_hash and e.created_at>now()-interval '24 hours') >= 5 then
   raise exception 'Guestbook submission limit reached' using errcode='P2012';
 end if;
 if (select count(*) from snoozer.guestbook_entries e where e.profile_id=v_profile_id
     and e.created_at>now()-interval '24 hours') >= 500 then
   raise exception 'Guestbook is temporarily full' using errcode='P2013';
 end if;
 with old_entries as (
   select id from snoozer.guestbook_entries where profile_id=v_profile_id
     and status='rejected' and created_at<now()-interval '30 days'
   order by created_at limit 100
 )
 delete from snoozer.guestbook_entries e using old_entries o where e.id=o.id;
 insert into snoozer.guestbook_entries(profile_id,display_name,message,visitor_hash)
 values(v_profile_id,btrim(p_display_name),btrim(p_message),p_visitor_hash) returning id into entry_id;
 insert into snoozer.account_notifications(user_id,kind,title,body)
   select p.owner_id,'guestbook_message','New guestbook message',
     'A visitor left a message in your Guestbook. Review it in Studio.'
   from snoozer.profiles p where p.id=v_profile_id
     and not exists (
       select 1 from snoozer.account_notifications n
       where n.user_id=p.owner_id and n.kind='guestbook_message'
         and n.created_at>now()-interval '1 hour'
     );
 return entry_id;
end $$;

create function public.owner_guestbook_queue(p_profile uuid,p_limit integer default 50) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid := snoozer.verified_user();
begin
 if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor) then
   raise exception 'Profile unavailable' using errcode='42501';
 end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'displayName',q.display_name,
   'message',q.message,'status',q.status,'createdAt',q.created_at) order by q.created_at desc)
   from (select e.id,e.display_name,e.message,e.status,e.created_at
     from snoozer.guestbook_entries e where e.profile_id=p_profile
     order by e.created_at desc limit greatest(1,least(coalesce(p_limit,50),100))) q),'[]'::jsonb);
end $$;

create function public.moderate_guestbook_entry(p_profile uuid,p_entry uuid,p_status text) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.verified_user();
declare changed integer;
begin
 if p_status not in ('approved','rejected') then raise exception 'Invalid moderation action' using errcode='22023'; end if;
 update snoozer.guestbook_entries e set status=p_status,moderated_at=now()
 from snoozer.profiles p where e.id=p_entry and e.profile_id=p_profile
   and p.id=e.profile_id and p.owner_id=actor and e.status='pending';
 get diagnostics changed=row_count;
 return changed=1;
end $$;

create function public.delete_guestbook_entry(p_profile uuid,p_entry uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.verified_user();
declare changed integer;
begin
 delete from snoozer.guestbook_entries e using snoozer.profiles p
 where e.id=p_entry and e.profile_id=p_profile and p.id=e.profile_id and p.owner_id=actor;
 get diagnostics changed=row_count;
 return changed=1;
end $$;

create function public.get_public_poll_results(p_username text,p_poll uuid,p_visitor_hash text) returns jsonb
language sql stable security definer set search_path='' as $$
 select case when v.widgets->'poll'->>'enabled'='true'
   and v.widgets->'poll'->>'id'=p_poll::text
   and (
     v.widgets->'poll'->>'showResultsBeforeVote'='true'
     or v.widgets->'poll'->>'open'='false'
     or (v.widgets->'poll'->>'closesAt' is not null and (v.widgets->'poll'->>'closesAt')::timestamptz<=now())
     or exists(select 1 from snoozer.poll_votes mine
       where mine.profile_id=p.id and mine.poll_id=p_poll and mine.visitor_hash=p_visitor_hash)
   )
   then jsonb_build_object('pollId',p_poll,'total',coalesce(t.total,0),'counts',coalesce(t.counts,'{}'::jsonb))
   else null end
 from snoozer.profiles p join snoozer.published_profiles v
   on v.profile_id=p.id and v.revision=p.published_revision
 left join lateral (
   select count(*)::integer as total,
     coalesce(jsonb_object_agg(counts.option_id::text,counts.votes),'{}'::jsonb) as counts
   from (select option_id,count(*)::integer as votes from snoozer.poll_votes
     where profile_id=p.id and poll_id=p_poll group by option_id) counts
 ) t on true
 where p.username=p_username and p.published_revision is not null
$$;

create function public.submit_public_poll_vote(
 p_username text,p_poll uuid,p_option uuid,p_visitor_hash text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_profile uuid;
declare poll_config jsonb;
declare inserted boolean := false;
declare total integer;
declare counts jsonb;
declare inserted_count integer;
begin
 if p_visitor_hash is null or p_visitor_hash !~ '^[0-9a-f]{64}$' then
   raise exception 'Invalid voting token' using errcode='22023';
 end if;
 select p.id,v.widgets->'poll' into v_profile,poll_config
 from snoozer.profiles p join snoozer.published_profiles v
   on v.profile_id=p.id and v.revision=p.published_revision
 where p.username=p_username and p.published_revision is not null;
 if v_profile is null or poll_config is null or poll_config->>'enabled'<>'true'
   or poll_config->>'id'<>p_poll::text then raise exception 'Poll unavailable' using errcode='P2020'; end if;
 if poll_config->>'open'<>'true'
   or (poll_config->>'closesAt' is not null and (poll_config->>'closesAt')::timestamptz<=now()) then
   raise exception 'Poll is closed' using errcode='P2021';
 end if;
 if not exists(select 1 from jsonb_array_elements(poll_config->'options') o where o->>'id'=p_option::text) then
   raise exception 'Invalid poll option' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_poll::text||':'||p_visitor_hash,0));
 insert into snoozer.poll_votes(profile_id,poll_id,option_id,visitor_hash)
 values(v_profile,p_poll,p_option,p_visitor_hash)
 on conflict(profile_id,poll_id,visitor_hash) do nothing;
 get diagnostics inserted_count = row_count;
 inserted := inserted_count=1;
 with grouped as (
   select option_id,count(*)::integer as votes from snoozer.poll_votes
   where profile_id=v_profile and poll_id=p_poll group by option_id
 )
 select coalesce(sum(votes),0)::integer,
   coalesce(jsonb_object_agg(option_id::text,votes),'{}'::jsonb)
 into total,counts from grouped;
 return jsonb_build_object('accepted',inserted,'pollId',p_poll,'total',total,'counts',counts);
end $$;

revoke execute on function public.get_public_guestbook_entries(text,integer),
 public.submit_profile_guestbook_entry(text,text,text,text),
 public.get_public_poll_results(text,uuid,text),
 public.submit_public_poll_vote(text,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.get_public_guestbook_entries(text,integer),
 public.submit_profile_guestbook_entry(text,text,text,text),
 public.get_public_poll_results(text,uuid,text),
 public.submit_public_poll_vote(text,uuid,uuid,text) to service_role;

revoke execute on function public.owner_guestbook_queue(uuid,integer),
 public.moderate_guestbook_entry(uuid,uuid,text),public.delete_guestbook_entry(uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.owner_guestbook_queue(uuid,integer),
 public.moderate_guestbook_entry(uuid,uuid,text),public.delete_guestbook_entry(uuid,uuid)
 to authenticated;

commit;
