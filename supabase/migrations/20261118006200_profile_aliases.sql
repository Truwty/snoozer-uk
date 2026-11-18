-- One permanent registry gives profile and alias claims a real shared unique key.
lock table snoozer.profiles, snoozer.reserved_names in share row exclusive mode;
create table snoozer.public_names(name text primary key);
insert into snoozer.public_names select username from snoozer.profiles union select name from snoozer.reserved_names;
alter table snoozer.public_names enable row level security;
revoke all on snoozer.public_names from public,anon,authenticated,service_role;

create table snoozer.profile_aliases (
 name text primary key check(name ~ '^[a-z][a-z0-9-]{1,28}[a-z0-9]$'),
 profile_id uuid references snoozer.profiles(id) on delete set null,
 owner_id uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 retired_at timestamptz
);
create index profile_aliases_owner on snoozer.profile_aliases(owner_id,created_at,name);
alter table snoozer.profile_aliases enable row level security;
revoke all on snoozer.profile_aliases from public,anon,authenticated,service_role;

create function snoozer.reserve_public_name() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='reserved_names' then
  insert into snoozer.public_names values(new.name) on conflict do nothing;
 elsif tg_table_name='profiles' then
  if tg_op='INSERT' or new.username is distinct from old.username then insert into snoozer.public_names values(new.username); end if;
 else
  if tg_op='INSERT' or new.name is distinct from old.name then insert into snoozer.public_names values(new.name); end if;
 end if;
 return new;
end $$;
revoke execute on function snoozer.reserve_public_name() from public,anon,authenticated,service_role;
create trigger reserve_profile_name before insert or update of username on snoozer.profiles for each row execute function snoozer.reserve_public_name();
create trigger reserve_alias_name before insert or update of name on snoozer.profile_aliases for each row execute function snoozer.reserve_public_name();
create trigger reserve_application_name before insert or update of name on snoozer.reserved_names for each row execute function snoozer.reserve_public_name();

create or replace function public.username_available(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(p_name ~ '^[a-z][a-z0-9-]{1,28}[a-z0-9]$',false) and not exists(select 1 from snoozer.public_names where name=p_name)
$$;

create function snoozer.retire_orphan_alias() returns trigger language plpgsql set search_path='' as $$
begin
 if new.profile_id is null then new.retired_at := coalesce(new.retired_at,now()); end if;
 return new;
end $$;
revoke execute on function snoozer.retire_orphan_alias() from public,anon,authenticated,service_role;
create trigger retire_orphan_alias before update of profile_id on snoozer.profile_aliases for each row execute function snoozer.retire_orphan_alias();

create function public.manage_profile_alias(p_profile uuid,p_name text,p_operation text) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.verified_user();
declare existing snoozer.profile_aliases;
declare allowance integer;
declare used integer;
begin
 if p_name is null or p_name !~ '^[a-z][a-z0-9-]{1,28}[a-z0-9]$' or p_operation is null or p_operation not in ('create','renew','retire') then raise exception 'Invalid alias operation' using errcode='22023'; end if;
 perform 1 from auth.users where id=actor for update;
 perform 1 from snoozer.profiles where id=p_profile and owner_id=actor for key share;
 if not found then raise exception 'Profile unavailable' using errcode='42501'; end if;
 select * into existing from snoozer.profile_aliases where name=p_name for update;
 if p_operation<>'create' and (existing.name is null or existing.owner_id is distinct from actor or existing.profile_id is distinct from p_profile) then raise exception 'Alias unavailable' using errcode='42501'; end if;
 if p_operation='retire' then update snoozer.profile_aliases set retired_at=coalesce(retired_at,now()) where name=p_name; return; end if;
 if p_operation='renew' and existing.retired_at is not null then raise exception 'Alias is retired' using errcode='P1008'; end if;
 allowance := coalesce((select (plan).aliases from snoozer.effective_plan(actor)),0);
 select count(*) into used from snoozer.profile_aliases where owner_id=actor and retired_at is null and expires_at>now();
 if allowance=0 or used + (case when p_operation='create' or existing.expires_at<=now() then 1 else 0 end) > allowance then raise exception 'Alias allowance reached' using errcode='P1007'; end if;
 if p_operation='create' then
  if not public.username_available(p_name) then raise exception 'Address unavailable' using errcode='23505'; end if;
  if (select count(*) from snoozer.profile_aliases where owner_id=actor and created_at >= (date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'))>=5 then raise exception 'Daily alias claim limit reached' using errcode='P1001'; end if;
  insert into snoozer.profile_aliases(name,profile_id,owner_id,expires_at) values(p_name,p_profile,actor,now()+interval '90 days');
 else
  update snoozer.profile_aliases set expires_at=now()+interval '90 days' where name=p_name;
 end if;
end $$;

create function public.resolve_profile_alias(p_name text) returns text language sql stable security definer set search_path='' as $$
 select p.username from snoozer.profile_aliases a join snoozer.profiles p on p.id=a.profile_id and p.owner_id=a.owner_id
 where a.name=p_name and a.retired_at is null and a.expires_at>now() and p.published_revision is not null
 and (select count(*) from snoozer.profile_aliases earlier where earlier.owner_id=a.owner_id and earlier.retired_at is null and earlier.expires_at>now() and (earlier.created_at,earlier.name)<=(a.created_at,a.name)) <= coalesce((select (plan).aliases from snoozer.effective_plan(a.owner_id)),0)
$$;

create function public.list_my_aliases(p_profile uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid := snoozer.verified_user();
declare allowance integer := coalesce((select (plan).aliases from snoozer.effective_plan(actor)),0);
begin
 if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor) then raise exception 'Profile unavailable' using errcode='42501'; end if;
 return jsonb_build_object('limit',allowance,'used',(select count(*) from snoozer.profile_aliases where owner_id=actor and retired_at is null and expires_at>now()),'items',coalesce((
  select jsonb_agg(jsonb_build_object('name',a.name,'expiresAt',a.expires_at,'state',case when a.retired_at is not null then 'retired' when a.expires_at<=now() then 'expired' when a.slot>allowance then 'plan-limit' when p.published_revision is null then 'unpublished' else 'active' end) order by a.created_at desc,a.name)
  from (select * from (select a.*,row_number() over(order by (a.retired_at is null and a.expires_at>now()) desc,a.created_at,a.name) as slot from snoozer.profile_aliases a where a.owner_id=actor) ranked where profile_id=p_profile order by (retired_at is null and expires_at>now()) desc,created_at desc,name limit 100) a
  join snoozer.profiles p on p.id=a.profile_id
 ),'[]'::jsonb));
end $$;

create function public.resolve_public_address(p_name text) returns text language sql stable security definer set search_path='' as $$
 select coalesce((select username from snoozer.profiles where username=p_name and published_revision is not null),public.resolve_profile_alias(p_name))
$$;
revoke execute on function public.resolve_public_address(text) from public,anon,authenticated,service_role;
grant execute on function public.resolve_public_address(text) to anon,authenticated;

create or replace function public.published_profile_exists(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from snoozer.profiles where username=p_name and published_revision is not null) or public.resolve_profile_alias(p_name) is not null
$$;
revoke execute on function public.manage_profile_alias(uuid,text,text),public.list_my_aliases(uuid),public.resolve_profile_alias(text) from public,anon,authenticated,service_role;
grant execute on function public.manage_profile_alias(uuid,text,text),public.list_my_aliases(uuid) to authenticated;
grant execute on function public.resolve_profile_alias(text) to anon,authenticated;
