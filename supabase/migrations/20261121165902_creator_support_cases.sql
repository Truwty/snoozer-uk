begin;
-- Phase 5: independent, verified-buyer-only support intake.
-- No payment, entitlement, refund, checkout or fraud state is mutated here.
create table snoozer.creator_support_staff(
  actor_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);
create table snoozer.creator_support_cases(
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete restrict,
  reference_kind text not null check(reference_kind in ('purchase','membership')),
  reference_id uuid not null,
  issue text not null check(issue in ('payment','delivery','refund','dispute','other')),
  message text not null check(char_length(message) between 20 and 1500 and message=btrim(message)),
  state text not null default 'open' check(state in ('open','answered','closed')),
  staff_response text check(staff_response is null or char_length(staff_response) between 20 and 1500),
  answered_by uuid references auth.users(id) on delete set null,
  answered_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check((state='open' and staff_response is null and answered_by is null and answered_at is null) or
        (state='answered' and staff_response is not null and answered_by is not null and answered_at is not null) or
        (state='closed')),
  check((state='closed')=(closed_at is not null))
);
create unique index creator_support_one_unresolved
 on snoozer.creator_support_cases(buyer_id,reference_kind,reference_id,issue)
 where state in ('open','answered');
create index creator_support_buyer_recent on snoozer.creator_support_cases(buyer_id,created_at desc);
create index creator_support_staff_open on snoozer.creator_support_cases(state,created_at) where state='open';
create table snoozer.creator_support_access_log(
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  case_id uuid references snoozer.creator_support_cases(id) on delete restrict,
  action text not null check(action in ('list','reply')),
  at timestamptz not null default now()
);
alter table snoozer.creator_support_staff enable row level security;
alter table snoozer.creator_support_cases enable row level security;
alter table snoozer.creator_support_access_log enable row level security;
revoke all on snoozer.creator_support_staff,snoozer.creator_support_cases,snoozer.creator_support_access_log from public,anon,authenticated,service_role;
revoke all on sequence snoozer.creator_support_access_log_id_seq from public,anon,authenticated,service_role;

create function public.open_my_creator_support_case(p_kind text,p_reference uuid,p_issue text,p_message text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user(); existing uuid; created uuid; content text:=btrim(p_message);
begin
 if p_kind not in ('purchase','membership') or p_reference is null
    or p_issue not in ('payment','delivery','refund','dispute','other')
    or content is null or char_length(content) not between 20 and 1500
 then raise exception 'Invalid support request' using errcode='22023'; end if;
 -- Read only buyer ownership. The reference can outlive an expired checkout.
 if (p_kind='purchase' and not exists(
   select 1 from snoozer.creator_sandbox_orders where id=p_reference and buyer_id=actor))
  or (p_kind='membership' and not exists(
   select 1 from snoozer.creator_membership_subscriptions where id=p_reference and buyer_id=actor))
 then raise exception 'Support reference unavailable' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('creator-support:'||actor::text,0));
 select id into existing from snoozer.creator_support_cases
 where buyer_id=actor and reference_kind=p_kind and reference_id=p_reference
 and issue=p_issue and state in ('open','answered') order by created_at desc limit 1;
 if found then return existing; end if;
 if (select count(*) from snoozer.creator_support_cases where buyer_id=actor and created_at>now()-interval '24 hours')>=3
  or (select count(*) from snoozer.creator_support_cases where buyer_id=actor and state in ('open','answered'))>=5
  or (select count(*) from snoozer.creator_support_cases where buyer_id=actor)>=40
 then raise exception 'Support case limit reached' using errcode='P1317'; end if;
 insert into snoozer.creator_support_cases(buyer_id,reference_kind,reference_id,issue,message)
 values(actor,p_kind,p_reference,p_issue,content) returning id into created;
 return created;
end $$;

create function public.list_my_creator_support_cases()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 return coalesce((select jsonb_agg(jsonb_build_object(
   'id',c.id,'referenceKind',c.reference_kind,'referenceId',c.reference_id,
   'issue',c.issue,'message',c.message,'state',c.state,'response',c.staff_response,
   'createdAt',c.created_at,'updatedAt',c.updated_at,'answeredAt',c.answered_at,'closedAt',c.closed_at
 ) order by c.created_at desc,c.id) from
 (select * from snoozer.creator_support_cases where buyer_id=actor order by created_at desc,id limit 40) c),'[]'::jsonb);
end $$;

create function public.close_my_creator_support_case(p_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 update snoozer.creator_support_cases set state='closed',closed_at=now(),updated_at=now()
 where id=p_id and buyer_id=actor and state in ('open','answered');
 return found;
end $$;

create function public.can_read_creator_support_cases()
returns boolean language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 return exists(select 1 from snoozer.creator_support_staff where actor_id=actor);
end $$;

create function public.read_staff_creator_support_cases(p_limit integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 if not exists(select 1 from snoozer.creator_support_staff where actor_id=actor)
 then raise exception 'Support staff permission required' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 50 then raise exception 'Invalid limit' using errcode='22023'; end if;
 insert into snoozer.creator_support_access_log(actor_id,action) values(actor,'list');
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',c.id,'buyerId',c.buyer_id,'referenceKind',c.reference_kind,'referenceId',c.reference_id,
  'issue',c.issue,'message',c.message,'state',c.state,'response',c.staff_response,
  'createdAt',c.created_at,'answeredAt',c.answered_at
 ) order by c.created_at,c.id) from
 (select * from snoozer.creator_support_cases where state='open' order by created_at,id limit p_limit) c),'[]'::jsonb);
end $$;

create function public.reply_staff_creator_support_case(p_id uuid,p_response text)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user(); content text:=btrim(p_response);
begin
 if not exists(select 1 from snoozer.creator_support_staff where actor_id=actor)
 then raise exception 'Support staff permission required' using errcode='42501'; end if;
 if p_id is null or content is null or char_length(content) not between 20 and 1500
 then raise exception 'Invalid response' using errcode='22023'; end if;
 update snoozer.creator_support_cases
 set staff_response=content,answered_by=actor,answered_at=now(),updated_at=now(),state='answered'
 where id=p_id and state='open';
 if not found then return false; end if;
 insert into snoozer.creator_support_access_log(actor_id,case_id,action) values(actor,p_id,'reply');
 return true;
end $$;
revoke execute on function public.open_my_creator_support_case(text,uuid,text,text),
 public.list_my_creator_support_cases(),public.close_my_creator_support_case(uuid),
 public.can_read_creator_support_cases(),public.read_staff_creator_support_cases(integer),
 public.reply_staff_creator_support_case(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.open_my_creator_support_case(text,uuid,text,text),
 public.list_my_creator_support_cases(),public.close_my_creator_support_case(uuid),
 public.can_read_creator_support_cases(),public.read_staff_creator_support_cases(integer),
 public.reply_staff_creator_support_case(uuid,text) to authenticated;
commit;
