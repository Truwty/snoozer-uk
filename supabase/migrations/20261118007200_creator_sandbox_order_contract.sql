begin;
create table snoozer.creator_sandbox_policy (
 singleton boolean primary key default true check(singleton), enabled boolean not null default false,
 platform_id text check(platform_id ~ '^acct_[A-Za-z0-9]{1,128}$'), check(not enabled or platform_id is not null)
);
insert into snoozer.creator_sandbox_policy(singleton) values(true);
create table snoozer.creator_sandbox_offers (
 product_id uuid primary key references snoozer.product_drafts(id) on delete restrict,
 version_id uuid not null unique references snoozer.product_versions(id) on delete restrict,
 owner_id uuid not null references snoozer.creator_sandbox_accounts(owner_id) on delete restrict,
 reviewed_sha256 text not null check(reviewed_sha256 ~ '^[0-9a-f]{64}$'),
 review_expires_at timestamptz not null, enabled boolean not null default false
);
create table snoozer.creator_sandbox_orders (
 id uuid primary key default gen_random_uuid(), buyer_id uuid not null references auth.users(id) on delete restrict,
 seller_id uuid not null references snoozer.creator_sandbox_accounts(owner_id) on delete restrict,
 profile_id uuid not null references snoozer.profiles(id) on delete restrict,
 version_id uuid not null references snoozer.product_versions(id) on delete restrict,
 platform_id text not null check(platform_id ~ '^acct_[A-Za-z0-9]{1,128}$'),
 account_id text not null check(account_id ~ '^acct_[A-Za-z0-9]{1,128}$' and account_id<>platform_id),
 created_at timestamptz not null default now(), retained_until timestamptz not null default now()+interval '90 days',
 checkout_id text unique check(checkout_id ~ '^cs_test_[A-Za-z0-9]{1,255}$'), checkout_expires_at timestamptz,
 payment_id text unique check(payment_id ~ '^pi_[A-Za-z0-9]{1,128}$'), charge_id text unique check(charge_id ~ '^ch_[A-Za-z0-9]{1,128}$'),
 state text not null default 'pending' check(state in ('pending','paid','expired')),
 paid_at timestamptz, access_until timestamptz,
 holds text[] not null default '{}' check(holds<@array['refund','dispute','fraud']::text[]),
 check(buyer_id<>seller_id), check((checkout_id is null)=(checkout_expires_at is null)),
 check((paid_at is null)=(access_until is null)), check(state<>'paid' or (checkout_id is not null and payment_id is not null and charge_id is not null and paid_at is not null))
);
create index creator_sandbox_orders_buyer on snoozer.creator_sandbox_orders(buyer_id,created_at,id);
create index creator_sandbox_orders_seller on snoozer.creator_sandbox_orders(seller_id);
create index creator_sandbox_orders_profile on snoozer.creator_sandbox_orders(profile_id);
create index creator_sandbox_orders_version on snoozer.creator_sandbox_orders(version_id);
create unique index creator_sandbox_orders_pending on snoozer.creator_sandbox_orders(buyer_id,version_id) where state='pending';
create index creator_sandbox_orders_retention on snoozer.creator_sandbox_orders(retained_until) where state<>'pending';
alter table snoozer.creator_sandbox_policy enable row level security;
alter table snoozer.creator_sandbox_offers enable row level security;
alter table snoozer.creator_sandbox_orders enable row level security;
revoke all on snoozer.creator_sandbox_policy,snoozer.creator_sandbox_offers,snoozer.creator_sandbox_orders from public,anon,authenticated,service_role;

create function public.review_creator_sandbox_fixture(p_owner uuid,p_version uuid,p_sha256 text) returns boolean language plpgsql security definer set search_path='' as $$
declare item snoozer.product_versions; product snoozer.product_drafts;
begin
 perform 1 from auth.users where id=p_owner and email_confirmed_at is not null for update;
 if not found then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended('profile-media:'||p_owner::text,0));
 select v.* into item from snoozer.product_versions v join snoozer.product_drafts d on d.id=v.product_id where v.id=p_version and d.owner_id=p_owner;
 if not found or p_sha256 is null or item.sha256<>p_sha256 then return false; end if;
 select * into product from snoozer.product_drafts where id=item.product_id;
 if not exists(select 1 from snoozer.creator_sandbox_accounts where owner_id=p_owner and account_id is not null)
  or not exists(select 1 from snoozer.product_files where id=item.file_id and product_id=product.id and state='ready' and bytes=item.bytes) then return false; end if;
 -- This attests an operator-inspected sandbox fixture, never production malware clearance.
 insert into snoozer.creator_sandbox_offers(product_id,version_id,owner_id,reviewed_sha256,review_expires_at)
  values(product.id,item.id,p_owner,item.sha256,now()+interval '24 hours')
  on conflict(product_id) do update set version_id=excluded.version_id,reviewed_sha256=excluded.reviewed_sha256,review_expires_at=excluded.review_expires_at,enabled=false;
 return true;
end $$;

create function public.publish_my_creator_sandbox_offer(p_version uuid,p_enabled boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 perform 1 from auth.users where id=actor for update;
 perform pg_advisory_xact_lock(hashtextextended('profile-media:'||actor::text,0));
 if p_enabled is null then raise exception 'Invalid offer action' using errcode='22023'; end if;
 if not p_enabled then
  delete from snoozer.creator_sandbox_offers where owner_id=actor and version_id=p_version;
  return found;
 end if;
 update snoozer.creator_sandbox_offers o set enabled=true from snoozer.product_versions v,snoozer.product_drafts d,snoozer.profiles p,
  snoozer.creator_sandbox_accounts a,snoozer.creator_sandbox_policy policy
 where o.version_id=p_version and o.owner_id=actor and o.review_expires_at>now() and v.id=o.version_id and v.sha256=o.reviewed_sha256
  and d.id=o.product_id and v.product_id=d.id and d.owner_id=actor and not d.archived and p.id=d.profile_id and p.owner_id=actor
  and public.get_published_profile(p.username::text) is not null and a.owner_id=actor and a.ready and a.account_id is not null
  and a.checked_at>now()-interval '5 minutes' and policy.enabled and policy.platform_id=a.platform_id;
 if not found then raise exception 'Reviewed sandbox fixture and ready seller required' using errcode='P1220'; end if;
 return true;
end $$;

create function snoozer.creator_sandbox_order_json(p_order uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',o.id,'buyerId',o.buyer_id,'sellerId',o.seller_id,'profileId',o.profile_id,'versionId',o.version_id,
  'platformId',o.platform_id,'accountId',o.account_id,'createdAt',o.created_at,'checkoutId',o.checkout_id,'checkoutExpiresAt',o.checkout_expires_at,
  'paymentId',o.payment_id,'chargeId',o.charge_id,'state',o.state,'paidAt',o.paid_at,'accessUntil',o.access_until,'holds',o.holds,
  'title',v.title,'description',v.description,'amount',v.amount,'currency',v.currency,'bytes',v.bytes,'sha256',v.sha256)
 from snoozer.creator_sandbox_orders o join snoozer.product_versions v on v.id=o.version_id where o.id=p_order
$$;

create function public.reserve_creator_sandbox_order(p_buyer uuid,p_version uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
 insert into snoozer.creator_sandbox_orders(buyer_id,seller_id,profile_id,version_id,platform_id,account_id)
  values(p_buyer,product.owner_id,product.profile_id,p_version,merchant.platform_id,merchant.account_id) returning id into result;
 return snoozer.creator_sandbox_order_json(result);
end $$;

create function public.bind_creator_sandbox_checkout(p_order uuid,p_buyer uuid,p_account text,p_checkout text,p_expires timestamptz) returns boolean
language plpgsql security definer set search_path='' as $$
declare item snoozer.creator_sandbox_orders;
begin
 select * into item from snoozer.creator_sandbox_orders where id=p_order and buyer_id=p_buyer and account_id=p_account for update;
 if not found or p_checkout is null or p_checkout !~ '^cs_test_[A-Za-z0-9]{1,255}$' or p_expires is null then return false; end if;
 if item.checkout_id is not null then return item.checkout_id=p_checkout and item.checkout_expires_at=p_expires; end if;
 if item.state<>'pending' or item.created_at<now()-interval '23 hours' or p_expires<item.created_at+interval '30 minutes' or p_expires>item.created_at+interval '24 hours' then return false; end if;
 update snoozer.creator_sandbox_orders set checkout_id=p_checkout,checkout_expires_at=p_expires where id=item.id;
 return true;
end $$;

create function public.get_creator_sandbox_order(p_order uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select snoozer.creator_sandbox_order_json(p_order)
$$;
create function public.list_my_creator_sandbox_orders() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 return coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'versionId',o.version_id,'title',v.title,'amount',v.amount,'currency',v.currency,
  'state',o.state,'held',cardinality(o.holds)>0,'accessUntil',o.access_until,'createdAt',o.created_at) order by o.created_at desc,o.id)
  from snoozer.creator_sandbox_orders o join snoozer.product_versions v on v.id=o.version_id where buyer_id=actor),'[]'::jsonb);
end $$;

create function snoozer.retain_creator_order_profile() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from snoozer.creator_sandbox_orders where profile_id=old.id) or exists(select 1 from snoozer.creator_sandbox_offers o join snoozer.product_drafts d on d.id=o.product_id where d.profile_id=old.id) then
  raise exception 'Sandbox orders or offers retain this profile' using errcode='P1213';
 end if;
 return old;
end $$;
create trigger retain_creator_order_profile before delete on snoozer.profiles for each row execute function snoozer.retain_creator_order_profile();
revoke execute on function snoozer.creator_sandbox_order_json(uuid),snoozer.retain_creator_order_profile(),public.review_creator_sandbox_fixture(uuid,uuid,text),public.publish_my_creator_sandbox_offer(uuid,boolean),public.reserve_creator_sandbox_order(uuid,uuid),public.bind_creator_sandbox_checkout(uuid,uuid,text,text,timestamptz),public.get_creator_sandbox_order(uuid),public.list_my_creator_sandbox_orders() from public,anon,authenticated,service_role;
grant execute on function public.publish_my_creator_sandbox_offer(uuid,boolean),public.list_my_creator_sandbox_orders() to authenticated;
grant execute on function public.review_creator_sandbox_fixture(uuid,uuid,text),public.reserve_creator_sandbox_order(uuid,uuid),public.bind_creator_sandbox_checkout(uuid,uuid,text,text,timestamptz),public.get_creator_sandbox_order(uuid) to service_role;
commit;
