-- Feature #20: Prevent inaccurate "completed" GDPR deletion requests.
-- A checklist or typed ERASE text is NOT evidence that an Auth account was deleted.
-- Only a successfully reconciled erasure job, removed Auth identity and sent
-- completion notice permit a deletion request to close.
create or replace function public.owner_record_privacy_evidence(
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
 select r.user_id,r.kind into target,request_kind from snoozer.privacy_requests r
 where r.id=p_request and r.status in ('open','review') for update;
 if not found then return false; end if;
 if request_kind='deletion' then
  if exists(select 1 from snoozer.platform_owners where owner_id=target) then
    raise exception 'Protected Owner erasure requires separate legal process'
      using errcode='42501';
  end if;
  -- A normal Owner session must never invent the result of the Auth Admin API.
  if p_erasure and (
   exists(select 1 from auth.users where id=target)
   or not exists(select 1 from snoozer.privacy_erasure_jobs j
       where j.request_id=p_request and j.subject_id=target
       and j.status='completed')
  ) then
   raise exception 'Account erasure has not been independently verified'
     using errcode='23514';
  end if;
  -- The service records this event only after the sender accepts the email.
  if p_notice and not exists(
   select 1 from snoozer.admin_audit_events a
   where a.action='privacy.erasure.notice.sent'
     and a.details->>'request_id'=p_request::text
  ) then
   raise exception 'Erasure notice has not been sent'
     using errcode='23514';
  end if;
 end if;
 insert into snoozer.privacy_fulfilment_evidence(
  request_id,checked_by,checked_at,identity_verified,app_data_processed,
  private_media_processed,billing_processed,processors_processed,retention_reviewed,
  subscriptions_resolved,account_erasure_verified,secure_notice_sent,evidence_reference
 ) values (
  p_request,actor,now(),p_identity,p_app,p_media,p_billing,p_processors,p_retention,
  p_subscriptions,p_erasure,p_notice,btrim(p_reference)
 ) on conflict(request_id) do update set
  checked_by=excluded.checked_by,checked_at=now(),
  identity_verified=excluded.identity_verified,
  app_data_processed=excluded.app_data_processed,
  private_media_processed=excluded.private_media_processed,
  billing_processed=excluded.billing_processed,
  processors_processed=excluded.processors_processed,
  retention_reviewed=excluded.retention_reviewed,
  subscriptions_resolved=excluded.subscriptions_resolved,
  account_erasure_verified=excluded.account_erasure_verified,
  secure_notice_sent=excluded.secure_notice_sent,
  evidence_reference=excluded.evidence_reference;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,details)
 values(actor,target,'privacy.fulfilment.evidence',jsonb_build_object(
  'request',p_request,'kind',request_kind,
  'identity',p_identity,'app',p_app,'media',p_media,'billing',p_billing,
  'processors',p_processors,'retention',p_retention,'subscriptions',p_subscriptions,
  'erasure',p_erasure,'notice',p_notice));
 return true;
end $$;

create or replace function public.owner_review_privacy_request(
 p_request uuid,p_status text,p_response text
) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor(true);
 target uuid; request_kind text; evidence snoozer.privacy_fulfilment_evidence;
begin
 if p_status not in ('review','completed','rejected') or
    char_length(btrim(coalesce(p_response,''))) not between 12 and 1000 then
  raise exception 'Invalid review status or reason' using errcode='22023';
 end if;
 select r.user_id,r.kind into target,request_kind from snoozer.privacy_requests r
 where r.id=p_request and r.status in ('open','review') for update;
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
   raise exception 'Completion requires verified fulfilment evidence'
      using errcode='23514';
  end if;
  if request_kind='deletion' then
   if exists(select 1 from snoozer.platform_owners where owner_id=target)
      or not (evidence.subscriptions_resolved and evidence.account_erasure_verified)
      or exists(select 1 from auth.users where id=target)
      or not exists(select 1 from snoozer.privacy_erasure_jobs j
         where j.request_id=p_request and j.subject_id=target
           and j.status='completed')
      or not exists(select 1 from snoozer.admin_audit_events a
         where a.action='privacy.erasure.notice.sent'
           and a.details->>'request_id'=p_request::text)
   then
    raise exception 'Deletion is not verified: Auth erasure and notice required'
      using errcode='23514';
   end if;
  end if;
 end if;
 update snoozer.privacy_requests set status=p_status,
  owner_response=btrim(p_response),reviewed_at=now(),reviewed_by=actor
  where id=p_request;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,reason,details)
 values(actor,target,'privacy.review',btrim(p_response),
  jsonb_build_object('request',p_request,'kind',request_kind,'status',p_status));
 return true;
end $$;
-- Existing EXECUTE grants are preserved. All sensitive writes still require
-- snoozer.admin_actor(true), not user-controlled JWT claims.
