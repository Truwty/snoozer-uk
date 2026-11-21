begin;
-- Frozen-version allocation counters persist independently of retained orders.
-- A failed Checkout keeps its slot: no unverified late-payment recycle.
create table snoozer.creator_sandbox_stock(
 version_id uuid primary key references snoozer.product_versions(id) on delete restrict,
 owner_id uuid not null references auth.users(id) on delete restrict,
 profile_id uuid not null references snoozer.profiles(id) on delete restrict,
 total_slots integer not null check(total_slots between 1 and 50),
 reserved integer not null default 0 check(reserved>=0 and reserved<=total_slots),
 created_at timestamptz not null default now()
);
create index creator_sandbox_stock_profile on snoozer.creator_sandbox_stock(profile_id,owner_id);
alter table snoozer.creator_sandbox_stock enable row level security;
revoke all on snoozer.creator_sandbox_stock from public,anon,authenticated,service_role;

create function public.list_my_creator_sandbox_stock(p_profile uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 if p_profile is null or not exists(select 1 from snoozer.profiles p where p.id=p_profile and p.owner_id=actor)
 then raise exception 'Profile unavailable' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
   'versionId',v.id,'title',v.title,'revision',v.revision,
   'totalSlots',s.total_slots,'reserved',coalesce(s.reserved,0)
 ) order by v.created_at,v.id)
 from snoozer.product_versions v join snoozer.product_drafts d on d.id=v.product_id
 left join snoozer.creator_sandbox_stock s on s.version_id=v.id
 where d.owner_id=actor and d.profile_id=p_profile),'[]'::jsonb);
end $$;

create function public.set_my_creator_sandbox_stock(p_profile uuid,p_version uuid,p_limit integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user(); current_stock snoozer.creator_sandbox_stock;
begin
 -- The same owner row is locked by creator Checkout reservations.
 perform 1 from auth.users where id=actor for update;
 if p_profile is null or p_version is null or not exists(
   select 1 from snoozer.product_versions v
   join snoozer.product_drafts d on d.id=v.product_id
   where v.id=p_version and d.owner_id=actor and d.profile_id=p_profile
 ) then raise exception 'Version not owned' using errcode='42501'; end if;
 if p_limit is not null and p_limit not between 1 and 50
 then raise exception 'Limit must be between one and fifty' using errcode='22023'; end if;

 select * into current_stock from snoozer.creator_sandbox_stock where version_id=p_version for update;
 -- Once any Checkout reservation exists, inventory becomes immutable. History
 -- cannot be silently rewritten by seller, even after 90-day order retention.
 if coalesce(current_stock.reserved,0)>0 or exists(select 1 from snoozer.creator_sandbox_orders where version_id=p_version)
 then raise exception 'Stock is locked after first purchase attempt' using errcode='P1223'; end if;
 if p_limit is null then
   delete from snoozer.creator_sandbox_stock where version_id=p_version;
 else
   insert into snoozer.creator_sandbox_stock(version_id,owner_id,profile_id,total_slots)
   values(p_version,actor,p_profile,p_limit)
   on conflict(version_id) do update set total_slots=excluded.total_slots;
 end if;
 return true;
end $$;

-- Only versions already included in the canonical, operator-reviewed sandbox
-- storefront are reported. Unlimited versions are omitted from this list.
create function public.get_creator_sandbox_stock(p_name text) returns jsonb
language sql stable security definer set search_path='' as $$
 with eligible as (select (item.value->>'versionId')::uuid as version_id
   from jsonb_array_elements(coalesce(public.get_creator_sandbox_store(p_name)->'items','[]'::jsonb)) as item)
 select coalesce(jsonb_agg(jsonb_build_object(
   'versionId',s.version_id,'remaining',s.total_slots-s.reserved
 ) order by s.version_id),'[]'::jsonb)
 from snoozer.creator_sandbox_stock s join eligible e on e.version_id=s.version_id
$$;

-- Preserve every existing reservation safeguard and the same service-only grant.
-- The only new condition is the atomic stock allocation immediately before
-- the original order insertion, after same-buyer idempotent-resume handling.
create or replace function public.reserve_creator_sandbox_order(p_buyer uuid,p_version uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare product snoozer.product_drafts; merchant snoozer.creator_sandbox_accounts; existing snoozer.creator_sandbox_orders; result uuid;
begin
 select d.* into product from snoozer.product_versions v join snoozer.product_drafts d on d.id=v.product_id where v.id=p_version;
 if not found then raise exception 'Product unavailable' using errcode='P1220'; end if;
 -- Consistent ordering also covers two creators purchasing from one another.
 perform 1 from auth.users where id in(p_buyer,product.owner_id) order by id for update;
 if p_buyer=product.owner_id or not exists(select 1 from auth.users where id=p_buyer and email_confirmed_at is not null)
  or not exists(select 1 from auth.users where id=product.owner_id and email_confirmed_at is not null) then raise exception 'Verified independent buyer and seller required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('profile-media:'||product.owner_id::text,0));
 select * into merchant from snoozer.creator_sandbox_accounts where owner_id=product.owner_id for update;
 if merchant.account_id is null or not merchant.ready or merchant.checked_at is null or merchant.checked_at<=now()-interval '5 minutes'
  or not exists(select 1 from snoozer.creator_sandbox_policy where enabled and platform_id=merchant.platform_id)
  or not exists(select 1 from snoozer.creator_sandbox_offers o join snoozer.product_versions v on v.id=o.version_id
   join snoozer.product_drafts d on d.id=o.product_id join snoozer.profiles p on p.id=d.profile_id
   where o.version_id=p_version and o.owner_id=product.owner_id and o.enabled and o.review_expires_at>now() and o.reviewed_sha256=v.sha256
    and not d.archived and public.get_published_profile(p.username::text) is not null) then
  raise exception 'Sandbox offer unavailable' using errcode='P1220';
 end if;
 select * into existing from snoozer.creator_sandbox_orders where buyer_id=p_buyer and version_id=p_version
  and (state='pending' or (state='paid' and cardinality(holds)=0 and access_until>now())) order by created_at desc limit 1 for update;
 if found then
  if existing.state='pending' and existing.checkout_id is null and existing.created_at<now()-interval '23 hours' then raise exception 'Uncertain Checkout requires reconciliation' using errcode='P1210'; end if;
  return snoozer.creator_sandbox_order_json(existing.id);
 end if;
 if (select count(*) from snoozer.creator_sandbox_orders where buyer_id=p_buyer)>=64
  or (select count(*) from snoozer.creator_sandbox_orders where buyer_id=p_buyer and state='pending')>=5
  or (select count(*) from snoozer.creator_sandbox_orders where seller_id=product.owner_id)>=500 then raise exception 'Sandbox order limit reached' using errcode='P1221'; end if;
 -- The seller user-row lock above serialises all reservations for this seller.
 -- A limited edition slot is consumed permanently once a reservation is made,
 -- even if a Checkout later expires, is disputed or is refunded. This prevents
 -- a delayed signed payment from exceeding the configured hard cap.
 if exists(select 1 from snoozer.creator_sandbox_stock where version_id=p_version) then
   update snoozer.creator_sandbox_stock set reserved=reserved+1
    where version_id=p_version and reserved<total_slots;
   if not found then raise exception 'Limited sandbox stock exhausted' using errcode='P1222'; end if;
 end if;
 insert into snoozer.creator_sandbox_orders(buyer_id,seller_id,profile_id,version_id,platform_id,account_id)
  values(p_buyer,product.owner_id,product.profile_id,p_version,merchant.platform_id,merchant.account_id) returning id into result;
 return snoozer.creator_sandbox_order_json(result);
end $$;


revoke execute on function public.list_my_creator_sandbox_stock(uuid),
 public.set_my_creator_sandbox_stock(uuid,uuid,integer),
 public.get_creator_sandbox_stock(text) from public,anon,authenticated,service_role;
grant execute on function public.list_my_creator_sandbox_stock(uuid),
 public.set_my_creator_sandbox_stock(uuid,uuid,integer) to authenticated;
grant execute on function public.get_creator_sandbox_stock(text) to anon,authenticated;
commit;
