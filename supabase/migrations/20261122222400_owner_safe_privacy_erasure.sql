-- Feature #20: narrowly scoped, Owner-AAL2, processor-attested erasure.
-- The executor is opt-in at the app layer. It MUST NOT touch active billing,
-- paid commerce, Supabase Storage files or retained cross-user records.
-- The Auth admin API performs the actual deletion; this migration never does.

-- Preserve audit evidence when a data subject is erased. An anonymised actor
-- cannot be used to recover the deleted account; only the old audit timestamp
-- and action metadata remain. Owner accounts remain protected from deletion.
alter table snoozer.admin_audit_events
 alter column actor_id drop not null;
alter table snoozer.admin_audit_events
 drop constraint admin_audit_events_actor_id_fkey;
alter table snoozer.admin_audit_events
 add constraint admin_audit_events_actor_id_fkey
 foreign key(actor_id) references auth.users(id) on delete set null;

create table snoozer.privacy_erasure_jobs (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique references snoozer.privacy_requests(id),
 actor_id uuid not null references auth.users(id),
 subject_id uuid not null,
 profile_scopes uuid[] not null default '{}'::uuid[],
 status text not null default 'prepared'
  check(status in ('prepared','completed','failed')),
 error_code text,
 created_at timestamptz not null default now(),
 finished_at timestamptz
);
alter table snoozer.privacy_erasure_jobs enable row level security;
revoke all on snoozer.privacy_erasure_jobs from public,anon,authenticated,service_role;

create function public.owner_prepare_privacy_erasure(p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor(true);
 subject uuid; kind text; state text;
 evidence snoozer.privacy_fulfilment_evidence;
 ref record; cnt bigint; job uuid; scopes uuid[];
begin
 select pr.user_id,pr.kind,pr.status into subject,kind,state
  from snoozer.privacy_requests pr where pr.id=p_request for update;
 if not found or kind<>'deletion' or state not in ('open','review')
 then raise exception 'Eligible deletion request required' using errcode='23514'; end if;
 if actor=subject or exists(select 1 from snoozer.platform_owners where owner_id=subject)
 then raise exception 'Owner erasure forbidden' using errcode='42501'; end if;
 if not exists(select 1 from auth.users
   where id=subject and email_confirmed_at is not null)
 then raise exception 'Verified Auth subject required' using errcode='23514'; end if;
 select * into evidence from snoozer.privacy_fulfilment_evidence
   where request_id=p_request;
 if not found or not (evidence.identity_verified and evidence.billing_processed
    and evidence.processors_processed and evidence.retention_reviewed
    and evidence.subscriptions_resolved)
 then raise exception 'Identity, billing, processor, retention and subscription attestations required'
  using errcode='23514'; end if;

 -- Fail closed on all known paid or creator commerce, including live records.
 if exists(select 1 from snoozer.premium_live_customers where owner_id=subject)
   or exists(select 1 from snoozer.premium_live_checkouts where owner_id=subject)
   or exists(select 1 from snoozer.product_drafts where owner_id=subject)
   or exists(select 1 from snoozer.creator_membership_subscriptions
      where buyer_id=subject or seller_id=subject)
 then raise exception 'Paid or creator data requires manual provider handling'
  using errcode='23514'; end if;

 -- Storage uploaded with a service key can have a null owner; inspecting
 -- only storage.objects.owner_id is NOT a sufficient check.
 if exists(select 1 from snoozer.profiles where owner_id=subject
     and (avatar is not null or avatar_upload_key is not null))
   or exists(select 1 from snoozer.gallery_items where owner_id=subject)
   or exists(select 1 from storage.objects o
      where o.owner=subject or o.owner_id=subject::text
       or exists (select 1 from snoozer.profiles p
          where p.owner_id=subject and o.name like p.media_scope::text||'/%'))
 then raise exception 'Private media must be erased via the Storage API and reviewed separately'
   using errcode='23514'; end if;

 -- Only direct ON DELETE CASCADE or SET NULL references may be handled by
 -- Auth deletion. Audit actor references are SET NULL to retain minimised
 -- action evidence. NO ACTION/RESTRICT references must be resolved manually.
 for ref in
   select cls.oid as relation_id, att.attname as column_name
   from pg_constraint con
    join pg_class cls on cls.oid=con.conrelid
    join pg_namespace ns on ns.oid=cls.relnamespace
    join pg_attribute att on att.attrelid=cls.oid and att.attnum=con.conkey[1]
   where con.contype='f' and con.confrelid='auth.users'::regclass
     and con.confdeltype in ('a','r')
     and array_length(con.conkey,1)=1 and ns.nspname in ('snoozer','public')
 loop
   execute format('select count(*) from %s where %I=$1',
      ref.relation_id::regclass,ref.column_name)
    into cnt using subject;
   if cnt>0 then
    raise exception 'Unresolved account dependencies require reviewed erasure'
      using errcode='23514';
   end if;
 end loop;
 -- Any cross-user/profile constraints that were not enumerated above still
 -- fail atomically inside Supabase Auth.admin.deleteUser().
 select coalesce(array_agg(p.media_scope),'{}'::uuid[]) into scopes
 from snoozer.profiles p where p.owner_id=subject;
 insert into snoozer.privacy_erasure_jobs(request_id,actor_id,subject_id,profile_scopes)
 values(p_request,actor,subject,scopes)
 on conflict(request_id) do update set
  actor_id=excluded.actor_id, profile_scopes=excluded.profile_scopes,
  status='prepared', error_code=null,
  finished_at=null
 returning id into job;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,details)
 values(actor,subject,'privacy.erasure.prepared',
   jsonb_build_object('request_id',p_request,'job_id',job));
 return jsonb_build_object('operation_id',job,'user_id',subject);
end $$;

-- Must be called only after an Owner AAL2 prepare step and a Supabase Auth
-- admin deleteUser result. Never trust a caller-supplied subject ID or a
-- success flag without checking whether the Auth row actually disappeared.
create function public.service_finish_privacy_erasure(
 p_operation uuid,p_success boolean,p_code text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare job snoozer.privacy_erasure_jobs; state text;
 ref record; leftovers bigint;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then
  raise exception 'Service role required' using errcode='42501'; end if;
 if p_success is null then return false; end if;
 select * into job from snoozer.privacy_erasure_jobs
   where id=p_operation and status='prepared' for update;
 if not found then return false; end if;
 if p_success and exists(select 1 from auth.users where id=job.subject_id)
 then raise exception 'Auth erasure cannot be confirmed' using errcode='23514'; end if;
 if p_success then
  -- Also reject any orphaned first-party owner records; a deleted Auth row
  -- alone is not sufficient evidence of full local application erasure.
  for ref in
   select c.table_name from information_schema.columns c
   where c.table_schema='snoozer' and c.column_name='owner_id'
    and c.data_type='uuid'
  loop
   execute format('select count(*) from %I.%I where owner_id=$1',
      'snoozer',ref.table_name) into leftovers using job.subject_id;
   if leftovers>0 then
    raise exception 'Local owned data remains after Auth deletion'
      using errcode='23514';
   end if;
  end loop;
  if exists(select 1 from storage.objects o
    where o.owner=job.subject_id or o.owner_id=job.subject_id::text
     or exists(select 1 from unnest(job.profile_scopes) as s(scope_id)
       where o.name like s.scope_id::text||'/%'))
  then raise exception 'Storage ownership remains after Auth deletion'
    using errcode='23514'; end if;
 end if;
 state:=case when p_success then 'completed' else 'failed' end;
 update snoozer.privacy_erasure_jobs set status=state,finished_at=now(),
  error_code=case when p_success then null else left(coalesce(p_code,'auth_erasure_error'),80) end
  where id=p_operation;
 if p_success then
  update snoozer.privacy_fulfilment_evidence
   set app_data_processed=true,private_media_processed=true,
    account_erasure_verified=true,checked_at=now()
   where request_id=job.request_id;
 end if;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,details)
 values(job.actor_id,job.subject_id,'privacy.erasure.result',
   jsonb_build_object('job_id',job.id,'request_id',job.request_id,'success',p_success));
 return true;
end $$;

-- An accepted mail send is not proof of delivery or a completed request;
-- retain the separate Owner evidence and completion controls.
create function public.service_mark_privacy_erasure_notice(p_operation uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare job snoozer.privacy_erasure_jobs;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then
  raise exception 'Service role required' using errcode='42501'; end if;
 select * into job from snoozer.privacy_erasure_jobs
 where id=p_operation and status='completed';
 if not found then return false; end if;
 update snoozer.privacy_fulfilment_evidence set secure_notice_sent=true,
  checked_at=now() where request_id=job.request_id;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,details)
 values(job.actor_id,job.subject_id,'privacy.erasure.notice.sent',
   jsonb_build_object('job_id',job.id,'request_id',job.request_id));
 return true;
end $$;

revoke all on function public.owner_prepare_privacy_erasure(uuid),
 public.service_finish_privacy_erasure(uuid,boolean,text),
 public.service_mark_privacy_erasure_notice(uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.owner_prepare_privacy_erasure(uuid)
 to authenticated;
grant execute on function public.service_finish_privacy_erasure(uuid,boolean,text),
 public.service_mark_privacy_erasure_notice(uuid) to service_role;
