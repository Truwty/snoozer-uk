begin;
-- Fail-closed reviewed sandbox product quarantine; never changes historical
-- orders, Stripe states, refund holds or seller money. No claim of malware scan.
create table snoozer.creator_product_moderators(
 actor_id uuid primary key references auth.users(id) on delete cascade,
 appointed_at timestamptz not null default now()
);
create table snoozer.creator_product_reports(
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id) on delete restrict,
 version_id uuid not null references snoozer.product_versions(id) on delete restrict,
 reason text not null check(reason in ('malware','copyright','impersonation','other')),
 detail text not null check(char_length(detail) between 25 and 1200 and detail=btrim(detail)),
 state text not null default 'open' check(state in ('open','dismissed','quarantined')),
 created_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id) on delete set null,
 reviewed_at timestamptz,
 check((state='open')=(reviewed_at is null)),
 check((reviewed_at is null)=(reviewed_by is null))
);
create unique index creator_product_open_report on snoozer.creator_product_reports(reporter_id,version_id,reason) where state='open';
create index creator_product_reports_queue on snoozer.creator_product_reports(created_at,id) where state='open';
create table snoozer.creator_product_quarantine(
 version_id uuid primary key references snoozer.product_versions(id) on delete restrict,
 report_id uuid not null references snoozer.creator_product_reports(id) on delete restrict,
 moderator_id uuid not null references auth.users(id) on delete restrict,
 quarantined_at timestamptz not null default now()
);
create table snoozer.creator_product_moderation_access(
 id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id) on delete set null,
 report_id uuid references snoozer.creator_product_reports(id) on delete restrict,
 action text not null check(action in ('list','dismiss','quarantine')),
 accessed_at timestamptz not null default now()
);
alter table snoozer.creator_product_moderators enable row level security;
alter table snoozer.creator_product_reports enable row level security;
alter table snoozer.creator_product_quarantine enable row level security;
alter table snoozer.creator_product_moderation_access enable row level security;
revoke all on snoozer.creator_product_moderators,snoozer.creator_product_reports,
 snoozer.creator_product_quarantine,snoozer.creator_product_moderation_access
 from public,anon,authenticated,service_role;
revoke all on sequence snoozer.creator_product_moderation_access_id_seq from public,anon,authenticated,service_role;

create function snoozer.prevent_quarantined_creator_offer() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.enabled and exists(select 1 from snoozer.creator_product_quarantine where version_id=new.version_id)
 then raise exception 'Reviewed version is quarantined' using errcode='42501'; end if;
 return new;
end $$;
create trigger creator_sandbox_quarantine before insert or update of enabled,version_id
on snoozer.creator_sandbox_offers for each row execute function snoozer.prevent_quarantined_creator_offer();

create function public.open_my_creator_product_report(p_version uuid,p_reason text,p_detail text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user(); text_value text:=btrim(p_detail);
 existing uuid; item_name text; created uuid;
begin
 if p_version is null or p_reason not in ('malware','copyright','impersonation','other')
  or text_value is null or char_length(text_value) not between 25 and 1200
 then raise exception 'Invalid product report' using errcode='22023'; end if;
 select p.username::text into item_name
 from snoozer.creator_sandbox_offers o
 join snoozer.product_drafts d on d.id=o.product_id and d.owner_id=o.owner_id
 join snoozer.profiles p on p.id=d.profile_id and p.owner_id=d.owner_id
 where o.version_id=p_version;
 if item_name is null or not exists(select 1 from jsonb_array_elements(
   coalesce(public.get_creator_sandbox_store(item_name)->'items','[]'::jsonb)) item
   where item->>'versionId'=p_version::text)
 then raise exception 'Product not publicly reportable' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('creator-report:'||actor::text,0));
 select id into existing from snoozer.creator_product_reports
 where reporter_id=actor and version_id=p_version and reason=p_reason and state='open' for update;
 if found then return existing; end if;
 if (select count(*) from snoozer.creator_product_reports where reporter_id=actor and created_at>now()-interval '24 hours')>=3
  or (select count(*) from snoozer.creator_product_reports where reporter_id=actor)>=20
 then raise exception 'Report limit reached' using errcode='P1316'; end if;
 insert into snoozer.creator_product_reports(reporter_id,version_id,reason,detail)
 values(actor,p_version,p_reason,text_value) returning id into created;
 return created;
end $$;

create function public.list_my_creator_product_reports()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',r.id,'versionId',r.version_id,'reason',r.reason,'detail',r.detail,
  'state',r.state,'createdAt',r.created_at,'reviewedAt',r.reviewed_at
 ) order by r.created_at desc,r.id) from
 (select * from snoozer.creator_product_reports where reporter_id=actor order by created_at desc,id limit 20) r),'[]'::jsonb);
end $$;

create function public.can_moderate_creator_products()
returns boolean language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 return exists(select 1 from snoozer.creator_product_moderators where actor_id=actor);
end $$;

create function public.read_creator_product_reports(p_limit integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 if not exists(select 1 from snoozer.creator_product_moderators where actor_id=actor)
 then raise exception 'Moderator required' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 50 then raise exception 'Invalid limit' using errcode='22023'; end if;
 insert into snoozer.creator_product_moderation_access(actor_id,action) values(actor,'list');
 return coalesce((select jsonb_agg(jsonb_build_object(
   'id',r.id,'versionId',r.version_id,'reporterId',r.reporter_id,
   'reason',r.reason,'detail',r.detail,'createdAt',r.created_at,
   'productTitle',v.title,'ownerId',d.owner_id
 ) order by r.created_at,r.id)
 from (select * from snoozer.creator_product_reports where state='open' order by created_at,id limit p_limit) r
 join snoozer.product_versions v on v.id=r.version_id
 join snoozer.product_drafts d on d.id=v.product_id),'[]'::jsonb);
end $$;

create function public.resolve_creator_product_report(p_report uuid,p_action text)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user(); item snoozer.creator_product_reports;
begin
 if not exists(select 1 from snoozer.creator_product_moderators where actor_id=actor)
 then raise exception 'Moderator required' using errcode='42501'; end if;
 if p_action not in ('dismiss','quarantine') or p_report is null
 then raise exception 'Invalid moderation decision' using errcode='22023'; end if;
 select * into item from snoozer.creator_product_reports where id=p_report and state='open' for update;
 if not found then return false; end if;
 if p_action='quarantine' then
  -- Insert block before disabling the offer: future attempts to re-enable are
  -- rejected by the trigger. Existing orders and receipts remain immutable.
  insert into snoozer.creator_product_quarantine(version_id,report_id,moderator_id)
  values(item.version_id,p_report,actor) on conflict(version_id) do nothing;
  update snoozer.creator_sandbox_offers set enabled=false where version_id=item.version_id;
 end if;
 update snoozer.creator_product_reports set
  state=case when p_action='quarantine' then 'quarantined' else 'dismissed' end,
  reviewed_by=actor,reviewed_at=now() where id=p_report;
 insert into snoozer.creator_product_moderation_access(actor_id,report_id,action)
 values(actor,p_report,p_action);
 return true;
end $$;

-- The existing buyer delivery RPC also checks moderation quarantine. This is
-- independent of financial risk holds, retained order rows and PDF byte proofs.
create or replace function public.get_my_creator_order_file(p_order uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 with actor as materialized(select snoozer.verified_user() as id)
 select jsonb_build_object('orderId',o.id,'versionId',v.id,'sha256',v.sha256,
  'productId',d.id,'id',f.id,'scope',f.media_scope,'bytes',v.bytes,'state',f.state)
 from actor join snoozer.creator_sandbox_orders o on o.buyer_id=actor.id
 join snoozer.product_versions v on v.id=o.version_id
 join snoozer.product_drafts d on d.id=v.product_id and d.profile_id=o.profile_id and d.owner_id=o.seller_id
 join snoozer.product_files f on f.id=v.file_id and f.product_id=d.id and f.bytes=v.bytes and f.state='ready'
 join snoozer.profiles p on p.id=o.profile_id and p.owner_id=o.seller_id and p.media_scope=f.media_scope
 where o.id=p_order and o.state='paid' and cardinality(o.holds)=0 and o.access_until>now()
  and o.provider_checked_at>now()-interval '30 seconds'
  and not exists(select 1 from snoozer.creator_product_quarantine q where q.version_id=o.version_id)
$$;

create or replace function public.list_my_creator_sandbox_orders()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',o.id,'versionId',o.version_id,'title',v.title,
  'amount',coalesce(o.charged_amount,v.amount),'currency',v.currency,
  'originalAmount',v.amount,'paidAt',o.paid_at,'holds',o.holds,
  'state',o.state,'held',cardinality(o.holds)>0,'accessUntil',o.access_until,'createdAt',o.created_at,
  'accessActive',o.state='paid' and cardinality(o.holds)=0 and o.access_until>now() and
   not exists(select 1 from snoozer.creator_product_quarantine q where q.version_id=o.version_id)
 ) order by o.created_at desc,o.id)
 from snoozer.creator_sandbox_orders o join snoozer.product_versions v on v.id=o.version_id where o.buyer_id=actor),'[]'::jsonb);
end $$;

revoke execute on function snoozer.prevent_quarantined_creator_offer(),
 public.open_my_creator_product_report(uuid,text,text),public.list_my_creator_product_reports(),
 public.can_moderate_creator_products(),public.read_creator_product_reports(integer),
 public.resolve_creator_product_report(uuid,text)
 from public,anon,authenticated,service_role;
grant execute on function public.open_my_creator_product_report(uuid,text,text),
 public.list_my_creator_product_reports(),public.can_moderate_creator_products(),
 public.read_creator_product_reports(integer),public.resolve_creator_product_report(uuid,text)
 to authenticated;
commit;
