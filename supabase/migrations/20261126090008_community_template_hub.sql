begin;

create table snoozer.template_activity (
  owner_id uuid not null references auth.users(id) on delete cascade,
  template_key text not null check (char_length(template_key) between 1 and 120 and template_key ~ '^[a-zA-Z0-9-]+$'),
  favorited_at timestamptz,
  last_used_at timestamptz,
  primary key(owner_id,template_key)
);
create index template_activity_recent on snoozer.template_activity(owner_id,last_used_at desc) where last_used_at is not null;

create table snoozer.community_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 60),
  description text not null default '' check (char_length(description) <= 280),
  config jsonb not null check (jsonb_typeof(config)='object' and octet_length(config::text)<=65536),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique(id,owner_id)
);
create index community_templates_public on snoozer.community_templates(created_at desc) where status='approved';
create table snoozer.community_template_reports (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references snoozer.community_templates(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 8 and 500),
  created_at timestamptz not null default now(),
  unique(template_id,reporter_id)
);

create function snoozer.valid_template_activity_key(p_key text) returns boolean
language sql stable security definer set search_path to '' as $$
  select case
    when p_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then exists(select 1 from snoozer.community_templates where id=p_key::uuid and status='approved')
    else p_key ~ '^(arcade|backstage|bloom|brutalist|cel|cloud|desert|dusk|esports|forest|gallery|goldline|grain|lilac|matrix|mono|noir|obsidian|ocean|oni|paper|pixel|sakura|slate|studio|synthwave|terminal|velvet|vinyl|waveform)-(nocturne|glacier|parchment|afterglow)$'
  end
$$;
revoke all on function snoozer.valid_template_activity_key(text) from public,anon,authenticated,service_role;
alter table snoozer.template_activity enable row level security;
alter table snoozer.community_templates enable row level security;
alter table snoozer.community_template_reports enable row level security;
revoke all on snoozer.template_activity,snoozer.community_templates,snoozer.community_template_reports from public,anon,authenticated,service_role;

create function public.get_my_template_activity() returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare actor uuid:=snoozer.verified_user();
begin return jsonb_build_object(
 'favorites',coalesce((select jsonb_agg(template_key order by favorited_at desc) from snoozer.template_activity where owner_id=actor and favorited_at is not null),'[]'::jsonb),
 'recent',coalesce((select jsonb_agg(template_key order by last_used_at desc) from (select template_key,last_used_at from snoozer.template_activity where owner_id=actor and last_used_at is not null order by last_used_at desc limit 50) recent_items),'[]'::jsonb),
 'uploads',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description,'status',status,'created_at',created_at) order by created_at desc) from snoozer.community_templates where owner_id=actor),'[]'::jsonb),
 'community',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description,'created_at',created_at) order by created_at desc) from (select id,title,description,created_at from snoozer.community_templates where status='approved' order by created_at desc limit 100) community_items),'[]'::jsonb)); end $$;

create function public.set_my_template_favorite(p_key text,p_favorite boolean) returns boolean
language plpgsql security definer set search_path to '' as $$
declare actor uuid:=snoozer.verified_user();
begin
 if p_key is null or p_key !~ '^[a-zA-Z0-9-]{1,120}$' or p_favorite is null then raise exception 'Invalid template selection' using errcode='22023'; end if;
 if p_favorite and not snoozer.valid_template_activity_key(p_key) then raise exception 'Template is not available' using errcode='P0002'; end if;
 if not exists(select 1 from snoozer.template_activity where owner_id=actor and template_key=p_key) then
   perform 1 from auth.users where id=actor for update;
   if (select count(*) from snoozer.template_activity where owner_id=actor)>=200 then raise exception 'Template activity limit reached' using errcode='P1201'; end if;
 end if;
 insert into snoozer.template_activity(owner_id,template_key,favorited_at) values(actor,p_key,case when p_favorite then now() else null end)
 on conflict(owner_id,template_key) do update set favorited_at=case when p_favorite then now() else null end;
 return p_favorite;
end $$;

create function public.record_my_template_use(p_key text) returns boolean
language plpgsql security definer set search_path to '' as $$
declare actor uuid:=snoozer.verified_user();
begin
 if p_key is null or not snoozer.valid_template_activity_key(p_key) then raise exception 'Template is not available' using errcode='P0002'; end if;
 if not exists(select 1 from snoozer.template_activity where owner_id=actor and template_key=p_key) then
   perform 1 from auth.users where id=actor for update;
   if (select count(*) from snoozer.template_activity where owner_id=actor)>=200 then raise exception 'Template activity limit reached' using errcode='P1201'; end if;
 end if;
 insert into snoozer.template_activity(owner_id,template_key,last_used_at) values(actor,p_key,now())
 on conflict(owner_id,template_key) do update set last_used_at=now();
 return true;
end $$;

create function public.submit_community_template(p_profile uuid,p_title text,p_description text,p_config jsonb) returns uuid
language plpgsql security definer set search_path to '' as $$
declare actor uuid:=snoozer.verified_user(); created uuid;
begin
 if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor) then raise exception 'Profile not found' using errcode='P0002'; end if;
 if p_title is null or char_length(btrim(p_title)) not between 2 and 60 or p_description is null or char_length(p_description)>280
   or p_config is null or jsonb_typeof(p_config)<>'object' or octet_length(p_config::text)>65536
   or exists(select 1 from jsonb_object_keys(p_config) k where k not in ('theme','appearance','sections')) then raise exception 'Invalid template data' using errcode='22023'; end if;
 perform 1 from auth.users where id=actor for update;
 if (select count(*) from snoozer.community_templates where owner_id=actor)>=10 then raise exception 'Template submission limit reached' using errcode='P1201'; end if;
 insert into snoozer.community_templates(owner_id,title,description,config) values(actor,btrim(p_title),btrim(p_description),p_config) returning id into created;
 return created;
end $$;

create function public.get_community_template(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare actor uuid:=auth.uid(); item snoozer.community_templates;
begin
 select * into item from snoozer.community_templates t where t.id=p_id and (t.status='approved' or t.owner_id=actor);
 if not found then return null; end if;
 return jsonb_build_object('id',item.id,'title',item.title,'description',item.description,'status',item.status,'config',item.config);
end $$;

create function public.report_community_template(p_id uuid,p_reason text) returns uuid
language plpgsql security definer set search_path to '' as $$
declare actor uuid:=snoozer.verified_user(); report uuid;
begin
 if p_reason is null or char_length(btrim(p_reason)) not between 8 and 500 then raise exception 'Invalid report' using errcode='22023'; end if;
 if not exists(select 1 from snoozer.community_templates where id=p_id and status='approved' and owner_id<>actor) then raise exception 'Template not found' using errcode='P0002'; end if;
 insert into snoozer.community_template_reports(template_id,reporter_id,reason) values(p_id,actor,btrim(p_reason)) returning id into report;
 return report;
end $$;

create function public.owner_review_community_template(p_id uuid,p_status text) returns boolean
language plpgsql security definer set search_path to '' as $$
declare actor uuid:=snoozer.admin_actor(true); target uuid;
begin
 if p_status not in ('approved','rejected') then raise exception 'Invalid moderation status' using errcode='22023'; end if;
 update snoozer.community_templates set status=p_status,reviewed_at=now() where id=p_id and status='pending' returning owner_id into target;
 if target is null then return false; end if;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,reason,details)
 values(actor,target,'community_template.review',p_status,jsonb_build_object('template_id',p_id));
 return true;
end $$;

create function public.owner_community_template_queue() returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare actor uuid:=snoozer.admin_actor(true);
begin return coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'description',t.description,'config',t.config,
 'owner_id',t.owner_id,'created_at',t.created_at,'reports',coalesce((select jsonb_agg(jsonb_build_object('reason',r.reason,'created_at',r.created_at)) from snoozer.community_template_reports r where r.template_id=t.id),'[]'::jsonb)) order by t.created_at)
 from snoozer.community_templates t where t.status='pending'),'[]'::jsonb); end $$;

revoke all on function public.get_my_template_activity(),public.set_my_template_favorite(text,boolean),public.record_my_template_use(text),public.submit_community_template(uuid,text,text,jsonb),public.get_community_template(uuid),public.report_community_template(uuid,text),public.owner_review_community_template(uuid,text),public.owner_community_template_queue() from public,anon,authenticated,service_role;
grant execute on function public.get_my_template_activity(),public.set_my_template_favorite(text,boolean),public.record_my_template_use(text),public.submit_community_template(uuid,text,text,jsonb),public.get_community_template(uuid),public.report_community_template(uuid,text) to authenticated;
grant execute on function public.get_community_template(uuid) to anon;
grant execute on function public.owner_review_community_template(uuid,text) to authenticated;
grant execute on function public.owner_community_template_queue() to authenticated;
commit;
