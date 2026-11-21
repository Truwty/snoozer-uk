begin;
-- Historical orders retain their original immutable version price. New orders
-- snapshot their effective price at reservation, before any provider request.
alter table snoozer.creator_sandbox_orders add column charged_amount integer
 check(charged_amount between 50 and 100000);
create table snoozer.creator_sandbox_discounts (
 id uuid primary key default gen_random_uuid(),
 version_id uuid not null references snoozer.product_versions(id) on delete cascade,
 code text not null check(code collate "C" ~ '^[A-Z0-9][A-Z0-9-]{2,23}$'),
 percent_off integer not null check(percent_off between 1 and 90),
 max_uses integer not null check(max_uses between 1 and 50),
 used integer not null default 0 check(used between 0 and max_uses),
 expires_at timestamptz not null,
 disabled boolean not null default false,
 created_at timestamptz not null default now(),
 unique(version_id,code)
);
alter table snoozer.creator_sandbox_orders add column discount_id uuid
 references snoozer.creator_sandbox_discounts(id) on delete restrict,
 add constraint creator_discount_amount_present check(discount_id is null or charged_amount is not null);
alter table snoozer.creator_sandbox_discounts enable row level security;
revoke all on snoozer.creator_sandbox_discounts from public,anon,authenticated,service_role;

create function snoozer.guard_creator_order_price() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.charged_amount is distinct from old.charged_amount or new.discount_id is distinct from old.discount_id
 then raise exception 'Reserved price is immutable' using errcode='22023'; end if;
 return new;
end $$;
create trigger creator_order_price_immutable before update on snoozer.creator_sandbox_orders
 for each row execute function snoozer.guard_creator_order_price();
revoke execute on function snoozer.guard_creator_order_price() from public,anon,authenticated,service_role;

create function public.list_my_creator_discounts(p_profile uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor)
 then raise exception 'Profile unavailable' using errcode='42501'; end if;
 return jsonb_build_object('versions',coalesce((select jsonb_agg(jsonb_build_object(
 'id',v.id,'title',v.title,'revision',v.revision,'amount',v.amount) order by v.created_at,v.id)
 from snoozer.product_versions v join snoozer.product_drafts d on d.id=v.product_id
 where d.owner_id=actor and d.profile_id=p_profile and not d.archived),'[]'::jsonb),
 'codes',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'versionId',c.version_id,'code',c.code,
 'title',v.title,'percentOff',c.percent_off,'maxUses',c.max_uses,'used',c.used,
 'expiresAt',c.expires_at,'disabled',c.disabled) order by c.created_at desc,c.id)
 from snoozer.creator_sandbox_discounts c join snoozer.product_versions v on v.id=c.version_id
 join snoozer.product_drafts d on d.id=v.product_id where d.owner_id=actor and d.profile_id=p_profile),'[]'::jsonb));
end $$;

create function public.create_my_creator_discount(p_profile uuid,p_version uuid,p_code text,p_percent integer,p_uses integer,p_days integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user(); base integer; result uuid;
begin
 perform 1 from auth.users where id=actor for update;
 perform pg_advisory_xact_lock(hashtextextended('profile-media:'||actor::text,0));
 select v.amount into base from snoozer.product_versions v join snoozer.product_drafts d on d.id=v.product_id
 where v.id=p_version and d.owner_id=actor and d.profile_id=p_profile and not d.archived;
 if not found then raise exception 'Version unavailable' using errcode='42501'; end if;
 if p_code is null or p_code collate "C" !~ '^[A-Z0-9][A-Z0-9-]{2,23}$'
 or p_percent is null or p_percent not between 1 and 90 or p_uses is null or p_uses not between 1 and 50
 or p_days is null or p_days not between 1 and 30 or base*(100-p_percent)/100<50
 or base*(100-p_percent)/100>=base
 then raise exception 'Invalid discount' using errcode='22023'; end if;
 if (select count(*) from snoozer.creator_sandbox_discounts c join snoozer.product_versions v on v.id=c.version_id
 join snoozer.product_drafts d on d.id=v.product_id where d.owner_id=actor)>=50
 then raise exception 'Discount quota reached' using errcode='P1224'; end if;
 insert into snoozer.creator_sandbox_discounts(version_id,code,percent_off,max_uses,expires_at)
 values(p_version,p_code,p_percent,p_uses,now()+make_interval(days=>p_days)) returning id into result;
 return result;
end $$;

create function public.disable_my_creator_discount(p_profile uuid,p_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 perform 1 from auth.users where id=actor for update;
 update snoozer.creator_sandbox_discounts c set disabled=true from snoozer.product_versions v,snoozer.product_drafts d
 where c.id=p_id and c.version_id=v.id and v.product_id=d.id and d.owner_id=actor and d.profile_id=p_profile;
 if not found then raise exception 'Discount unavailable' using errcode='42501'; end if;
 return true;
end $$;

create or replace function snoozer.creator_sandbox_order_json(p_order uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',o.id,'buyerId',o.buyer_id,'sellerId',o.seller_id,'profileId',o.profile_id,'versionId',o.version_id,
  'platformId',o.platform_id,'accountId',o.account_id,'createdAt',o.created_at,'checkoutId',o.checkout_id,'checkoutExpiresAt',o.checkout_expires_at,
  'paymentId',o.payment_id,'chargeId',o.charge_id,'state',o.state,'paidAt',o.paid_at,'accessUntil',o.access_until,'holds',o.holds,
  'title',v.title,'description',v.description,'amount',coalesce(o.charged_amount,v.amount),'currency',v.currency,'bytes',v.bytes,'sha256',v.sha256)
 from snoozer.creator_sandbox_orders o join snoozer.product_versions v on v.id=o.version_id where o.id=p_order
$$;

-- Single reservation implementation. Existing service RPC delegates here.
create function public.reserve_creator_sandbox_discount_order(p_buyer uuid,p_version uuid,p_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare product snoozer.product_drafts; merchant snoozer.creator_sandbox_accounts;
 existing snoozer.creator_sandbox_orders; result uuid; base integer; final_amount integer;
 discount snoozer.creator_sandbox_discounts;
begin
 select d.* into product from snoozer.product_versions v join snoozer.product_drafts d on d.id=v.product_id where v.id=p_version;
 if not found then raise exception 'Product unavailable' using errcode='P1220'; end if;
 perform 1 from auth.users where id in(p_buyer,product.owner_id) order by id for update;
 if p_buyer is null or p_buyer=product.owner_id or not exists(select 1 from auth.users where id=p_buyer and email_confirmed_at is not null)
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
 select amount into strict base from snoozer.product_versions where id=p_version;
 final_amount:=base;
 if p_code is not null then
  if p_code collate "C" !~ '^[A-Z0-9][A-Z0-9-]{2,23}$' then raise exception 'Discount unavailable' using errcode='P1225'; end if;
  select * into discount from snoozer.creator_sandbox_discounts where version_id=p_version and code=p_code for update;
  if not found or discount.disabled or discount.expires_at<=now() or discount.used>=discount.max_uses
  then raise exception 'Discount unavailable' using errcode='P1225'; end if;
  final_amount:=base*(100-discount.percent_off)/100;
  if final_amount<50 or final_amount>=base then raise exception 'Discount unavailable' using errcode='P1225'; end if;
  update snoozer.creator_sandbox_discounts set used=used+1 where id=discount.id and used<max_uses;
  if not found then raise exception 'Discount unavailable' using errcode='P1225'; end if;
 end if;
 if exists(select 1 from snoozer.creator_sandbox_stock where version_id=p_version) then
   update snoozer.creator_sandbox_stock set reserved=reserved+1 where version_id=p_version and reserved<total_slots;
   if not found then raise exception 'Limited sandbox stock exhausted' using errcode='P1222'; end if;
 end if;
 insert into snoozer.creator_sandbox_orders(buyer_id,seller_id,profile_id,version_id,platform_id,account_id,charged_amount,discount_id)
 values(p_buyer,product.owner_id,product.profile_id,p_version,merchant.platform_id,merchant.account_id,final_amount,discount.id) returning id into result;
 return snoozer.creator_sandbox_order_json(result);
end $$;

create or replace function public.reserve_creator_sandbox_order(p_buyer uuid,p_version uuid) returns jsonb
language sql security definer set search_path='' as $$
 select public.reserve_creator_sandbox_discount_order(p_buyer,p_version,null::text)
$$;

create or replace function public.list_my_creator_sandbox_orders() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 return coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'versionId',o.version_id,'title',v.title,'amount',coalesce(o.charged_amount,v.amount),'currency',v.currency,
  'state',o.state,'held',cardinality(o.holds)>0,'accessUntil',o.access_until,'createdAt',o.created_at,
  'accessActive',o.state='paid' and cardinality(o.holds)=0 and o.access_until>now()) order by o.created_at desc,o.id)
  from snoozer.creator_sandbox_orders o join snoozer.product_versions v on v.id=o.version_id where buyer_id=actor),'[]'::jsonb);
end $$;

create or replace function public.read_my_creator_storefront_analytics(p_profile uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user(); report jsonb;
begin
 if p_profile is null or not exists(select 1 from snoozer.profiles p where p.id=p_profile and p.owner_id=actor)
 then raise exception 'Creator analytics profile unavailable' using errcode='42501'; end if;
 with retained as materialized (
 select o.id,o.state,o.holds,o.created_at,o.access_until,coalesce(o.charged_amount,v.amount) as amount
 from snoozer.creator_sandbox_orders o join snoozer.product_versions v on v.id=o.version_id
 where o.profile_id=p_profile and o.seller_id=actor
 ), totals as (
 select count(*)::integer retained_orders,count(*) filter(where state='pending')::integer pending_orders,
 count(*) filter(where state='expired')::integer expired_orders,count(*) filter(where state='paid')::integer paid_orders,
 count(*) filter(where state='paid' and cardinality(holds)>0)::integer held_paid_orders,
 count(*) filter(where state='paid' and cardinality(holds)=0 and access_until>now())::integer downloadable_orders,
 coalesce(sum(amount) filter(where state='paid'),0)::bigint gross_test_pence from retained
 ), daily as (
 select d.day,count(r.id)::integer orders,count(r.id) filter(where r.state='paid')::integer paid,
 coalesce(sum(r.amount) filter(where r.state='paid'),0)::bigint gross_test_pence
 from generate_series(13,0,-1) as days(i)
 cross join lateral(select (timezone('UTC',now())::date-days.i)::date as day)d
 left join retained r on (r.created_at at time zone 'UTC')::date=d.day group by d.day
 ) select jsonb_build_object('retainedOrders',t.retained_orders,'pendingOrders',t.pending_orders,'expiredOrders',t.expired_orders,
 'paidOrders',t.paid_orders,'heldPaidOrders',t.held_paid_orders,'downloadableOrders',t.downloadable_orders,'grossTestPence',t.gross_test_pence,
 'days',(select coalesce(jsonb_agg(jsonb_build_object('day',d.day,'orders',d.orders,'paid',d.paid,'grossTestPence',d.gross_test_pence) order by d.day),'[]'::jsonb) from daily d)) into report from totals t;
 return report;
end $$;

revoke execute on function public.list_my_creator_discounts(uuid),public.create_my_creator_discount(uuid,uuid,text,integer,integer,integer),
 public.disable_my_creator_discount(uuid,uuid),public.reserve_creator_sandbox_discount_order(uuid,uuid,text),
 public.reserve_creator_sandbox_order(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.list_my_creator_discounts(uuid),public.create_my_creator_discount(uuid,uuid,text,integer,integer,integer),public.disable_my_creator_discount(uuid,uuid) to authenticated;
grant execute on function public.reserve_creator_sandbox_discount_order(uuid,uuid,text),public.reserve_creator_sandbox_order(uuid,uuid) to service_role;
commit;
