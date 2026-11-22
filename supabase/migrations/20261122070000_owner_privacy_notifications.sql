-- Private, audited data-subject request intake and in-app Owner action notices.
-- Deliberately does NOT delete Auth users or Stripe evidence automatically.
create table snoozer.privacy_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete restrict,
 kind text not null check(kind in ('export','deletion')),
 status text not null default 'open' check(status in ('open','review','completed','rejected','cancelled')),
 requested_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id),
 owner_response text check(owner_response is null or char_length(owner_response) between 12 and 1000)
);
create unique index privacy_open_request on snoozer.privacy_requests(user_id,kind)
 where status in ('open','review');
create index privacy_queue on snoozer.privacy_requests(status,requested_at desc);
alter table snoozer.privacy_requests enable row level security;
revoke all on snoozer.privacy_requests from public,anon,authenticated,service_role;

create table snoozer.account_notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('restriction','reinstatement','premium_granted','premium_revoked','appeal_review')),
 title text not null check(char_length(title) between 3 and 120),
 body text not null check(char_length(body) between 3 and 500),
 created_at timestamptz not null default now(),
 read_at timestamptz
);
create index account_notifications_recent on snoozer.account_notifications(user_id,created_at desc,id desc);
alter table snoozer.account_notifications enable row level security;
revoke all on snoozer.account_notifications from public,anon,authenticated,service_role;

-- This internal helper also permits restricted people to request access/deletion.
-- It requires an active Auth session, so revoked sessions cannot use it.
create function snoozer.privacy_actor() returns uuid
 language plpgsql stable security definer set search_path='' as $$
declare actor uuid := auth.uid(); sid text := auth.jwt()->>'session_id';
begin
 if actor is null or not exists(select 1 from auth.users u
  where u.id=actor and u.email_confirmed_at is not null) then
  raise exception 'Verified account required' using errcode='42501';
 end if;
 if sid is null or not exists(select 1 from auth.sessions s where s.id::text=sid and s.user_id=actor) then
  raise exception 'Active session required' using errcode='42501';
 end if;
 return actor;
end $$;
revoke all on function snoozer.privacy_actor() from public,anon,authenticated,service_role;

create function public.request_my_privacy_action(p_kind text) returns uuid
 language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.privacy_actor(); ticket uuid;
begin
 if p_kind not in ('export','deletion') then raise exception 'Invalid kind' using errcode='22023'; end if;
 select id into ticket from snoozer.privacy_requests where user_id=actor and kind=p_kind and status in ('open','review');
 if ticket is not null then return ticket; end if;
 insert into snoozer.privacy_requests(user_id,kind) values(actor,p_kind) returning id into ticket;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,details)
  values(actor,actor,'privacy.request',jsonb_build_object('request',ticket,'kind',p_kind));
 return ticket;
end $$;

create function public.my_privacy_requests() returns jsonb
 language plpgsql stable security definer set search_path='' as $$
declare actor uuid := snoozer.privacy_actor();
begin
 return coalesce((select jsonb_agg(to_jsonb(r)) from (
  select id,kind,status,requested_at,reviewed_at,owner_response
  from snoozer.privacy_requests where user_id=actor
  order by requested_at desc,id desc limit 30
 ) r),'[]'::jsonb);
end $$;

create function public.owner_privacy_requests(p_limit integer default 50) returns jsonb
 language plpgsql stable security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor();
begin
 return coalesce((select jsonb_agg(to_jsonb(r)) from (
  select p.id,p.user_id,u.email,p.kind,p.status,p.requested_at,p.reviewed_at,p.owner_response
  from snoozer.privacy_requests p join auth.users u on u.id=p.user_id
  order by case when p.status in ('open','review') then 0 else 1 end,p.requested_at asc,p.id asc
  limit least(greatest(coalesce(p_limit,50),1),100)
 ) r),'[]'::jsonb);
end $$;

create function public.owner_review_privacy_request(p_request uuid,p_status text,p_response text) returns boolean
 language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor(true); target uuid; request_kind text;
begin
 if p_status not in ('review','completed','rejected') or
 char_length(btrim(coalesce(p_response,''))) not between 12 and 1000 then
  raise exception 'Invalid review status or reason' using errcode='22023';
 end if;
 update snoozer.privacy_requests set status=p_status,owner_response=btrim(p_response),
  reviewed_at=now(),reviewed_by=actor
  where id=p_request and status in ('open','review') returning user_id,kind into target,request_kind;
 if target is null then return false; end if;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,reason,details)
 values(actor,target,'privacy.review',btrim(p_response),jsonb_build_object('request',p_request,'kind',request_kind,'status',p_status));
 return true;
end $$;

-- Notifications contain generic copy only; private case notes and reasons stay private.
create function snoozer.notify_admin_event() returns trigger
 language plpgsql security definer set search_path='' as $$
declare kind text; heading text; copy text;
begin
 if new.target_id is null then return new; end if;
 case new.action
 when 'account.restrict' then kind:='restriction';heading:='Account restricted';copy:='Your account access was restricted. Sign in to review the notice and appeal information.';
 when 'account.reinstate' then kind:='reinstatement';heading:='Account access restored';copy:='Your account restriction was lifted. You can sign in again.';
 when 'premium.grant' then kind:='premium_granted';heading:='Premium access granted';copy:='An Owner has granted Premium access to your account. Check your plan in Studio.';
 when 'premium.revoke' then kind:='premium_revoked';heading:='Premium grant revoked';copy:='An Owner-issued Premium grant has been revoked. Paid subscriptions are not affected by this notice.';
 when 'moderation.appeal_review' then kind:='appeal_review';heading:='Appeal reviewed';copy:='Your appeal received an Owner response. Review your case and appeal status.';
 else return new;
 end case;
 insert into snoozer.account_notifications(user_id,kind,title,body)
 values(new.target_id,kind,heading,copy);
 return new;
end $$;
revoke all on function snoozer.notify_admin_event() from public,anon,authenticated,service_role;
create trigger admin_notification_delivery after insert on snoozer.admin_audit_events
 for each row execute function snoozer.notify_admin_event();

create function public.my_account_notifications() returns jsonb
 language plpgsql stable security definer set search_path='' as $$
declare actor uuid := snoozer.privacy_actor();
begin
 return coalesce((select jsonb_agg(to_jsonb(n)) from (
  select id,kind,title,body,created_at,read_at
  from snoozer.account_notifications where user_id=actor
  order by created_at desc,id desc limit 50
 ) n),'[]'::jsonb);
end $$;
create function public.mark_account_notification_read(p_id uuid) returns boolean
 language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.privacy_actor();
begin
 update snoozer.account_notifications set read_at=coalesce(read_at,now())
 where id=p_id and user_id=actor;
 return found;
end $$;

revoke all on function public.request_my_privacy_action(text),public.my_privacy_requests(),
public.owner_privacy_requests(integer),public.owner_review_privacy_request(uuid,text,text),
public.my_account_notifications(),public.mark_account_notification_read(uuid)
from public,anon,authenticated,service_role;
grant execute on function public.request_my_privacy_action(text),public.my_privacy_requests(),
public.owner_privacy_requests(integer),public.owner_review_privacy_request(uuid,text,text),
public.my_account_notifications(),public.mark_account_notification_read(uuid) to authenticated;
