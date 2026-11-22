-- Feature #20: Owner-reviewed, evidence-backed privacy fulfilment.
-- No automatic deletion, payment cancellation or disclosure occurs in this migration.
create table snoozer.privacy_fulfilment_evidence (
 request_id uuid primary key references snoozer.privacy_requests(id) on delete cascade,
 checked_by uuid not null references auth.users(id),
 checked_at timestamptz not null default now(),
 identity_verified boolean not null default false,
 app_data_processed boolean not null default false,
 private_media_processed boolean not null default false,
 billing_processed boolean not null default false,
 processors_processed boolean not null default false,
 retention_reviewed boolean not null default false,
 subscriptions_resolved boolean not null default false,
 account_erasure_verified boolean not null default false,
 secure_notice_sent boolean not null default false,
 evidence_reference text not null check(char_length(evidence_reference) between 32 and 1000)
);
alter table snoozer.privacy_fulfilment_evidence enable row level security;
revoke all on snoozer.privacy_fulfilment_evidence from public,anon,authenticated,service_role;

create function public.owner_privacy_evidence(p_request uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor();
begin
 return (select to_jsonb(e) from (
  select checked_at,identity_verified,app_data_processed,private_media_processed,
    billing_processed,processors_processed,retention_reviewed,subscriptions_resolved,
    account_erasure_verified,secure_notice_sent,evidence_reference
  from snoozer.privacy_fulfilment_evidence where request_id=p_request
 ) e);
end $$;

create function public.owner_record_privacy_evidence(
 p_request uuid, p_identity boolean, p_app boolean, p_media boolean,
 p_billing boolean, p_processors boolean, p_retention boolean,
 p_subscriptions boolean, p_erasure boolean, p_notice boolean, p_reference text
) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor(true); target uuid; request_kind text;
begin
 if p_identity is null or p_app is null or p_media is null or p_billing is null or
    p_processors is null or p_retention is null or p_subscriptions is null or
    p_erasure is null or p_notice is null or
    char_length(btrim(coalesce(p_reference,''))) not between 32 and 1000 then
  raise exception 'Invalid fulfilment evidence' using errcode='22023';
 end if;
 select user_id,kind into target,request_kind from snoozer.privacy_requests
 where id=p_request and status in ('open','review') for update;
 if not found then return false; end if;
 if request_kind='deletion' and exists(
   select 1 from snoozer.platform_owners where owner_id=target) then
   raise exception 'Protected owner erasure requires separate legal process' using errcode='42501';
 end if;
 insert into snoozer.privacy_fulfilment_evidence(
  request_id,checked_by,checked_at,identity_verified,app_data_processed,
  private_media_processed,billing_processed,processors_processed,retention_reviewed,
  subscriptions_resolved,account_erasure_verified,secure_notice_sent,evidence_reference
 ) values (
  p_request,actor,now(),p_identity,p_app,p_media,p_billing,p_processors,p_retention,
  p_subscriptions,p_erasure,p_notice,btrim(p_reference)
 ) on conflict (request_id) do update set
  checked_by=excluded.checked_by,checked_at=now(),
  identity_verified=excluded.identity_verified,app_data_processed=excluded.app_data_processed,
  private_media_processed=excluded.private_media_processed,billing_processed=excluded.billing_processed,
  processors_processed=excluded.processors_processed,retention_reviewed=excluded.retention_reviewed,
  subscriptions_resolved=excluded.subscriptions_resolved,
  account_erasure_verified=excluded.account_erasure_verified,
  secure_notice_sent=excluded.secure_notice_sent,evidence_reference=excluded.evidence_reference;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,details)
 values(actor,target,'privacy.fulfilment.evidence',jsonb_build_object(
  'request',p_request,'kind',request_kind,
  'identity',p_identity,'app',p_app,'media',p_media,'billing',p_billing,
  'processors',p_processors,'retention',p_retention,'subscriptions',p_subscriptions,
  'erasure',p_erasure,'notice',p_notice));
 return true;
end $$;

-- Replace the previous "checkbox-only" completion path with enforced evidence.
create or replace function public.owner_review_privacy_request(
 p_request uuid,p_status text,p_response text
) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor(true); target uuid; request_kind text;
  evidence snoozer.privacy_fulfilment_evidence;
begin
 if p_status not in ('review','completed','rejected') or
    char_length(btrim(coalesce(p_response,''))) not between 12 and 1000 then
  raise exception 'Invalid review status or reason' using errcode='22023';
 end if;
 select user_id,kind into target,request_kind from snoozer.privacy_requests
 where id=p_request and status in ('open','review') for update;
 if not found then return false; end if;
 if p_status='completed' then
  select * into evidence from snoozer.privacy_fulfilment_evidence
   where request_id=p_request;
  if not found or not (
    evidence.identity_verified and evidence.app_data_processed and
    evidence.private_media_processed and evidence.billing_processed and
    evidence.processors_processed and evidence.retention_reviewed and
    evidence.secure_notice_sent
  ) then
   raise exception 'Completion requires verified fulfilment evidence' using errcode='23514';
  end if;
  if request_kind='deletion' and (
   exists(select 1 from snoozer.platform_owners where owner_id=target)
   or not (evidence.subscriptions_resolved and evidence.account_erasure_verified)
  ) then
   raise exception 'Deletion needs separate subscriptions and erasure proof' using errcode='23514';
  end if;
 end if;
 update snoozer.privacy_requests set status=p_status,owner_response=btrim(p_response),
  reviewed_at=now(),reviewed_by=actor where id=p_request;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,reason,details)
 values(actor,target,'privacy.review',btrim(p_response),
  jsonb_build_object('request',p_request,'kind',request_kind,'status',p_status));
 return true;
end $$;

revoke all on function public.owner_privacy_evidence(uuid),
  public.owner_record_privacy_evidence(uuid,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text)
 from public,anon,authenticated,service_role;
grant execute on function public.owner_privacy_evidence(uuid),
  public.owner_record_privacy_evidence(uuid,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text)
 to authenticated;
-- Keep the existing owner_review_privacy_request(uuid,text,text) EXECUTE grant unchanged.
