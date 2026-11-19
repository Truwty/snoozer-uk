begin;
alter table snoozer.creator_sandbox_orders add column provider_checked_at timestamptz;
alter table snoozer.creator_sandbox_orders add column next_check_at timestamptz not null default '-infinity';
create function snoozer.stamp_creator_sandbox_check() returns trigger language plpgsql set search_path='' as $$
begin new.provider_checked_at:=now(); return new; end $$;
create trigger stamp_creator_sandbox_check before update of state,holds,payment_id,charge_id on snoozer.creator_sandbox_orders
 for each row execute function snoozer.stamp_creator_sandbox_check();

create function public.owns_my_creator_sandbox_order(p_order uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from snoozer.creator_sandbox_orders where id=p_order and buyer_id=snoozer.verified_user())
$$;
create function public.claim_my_creator_order_check(p_order uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 update snoozer.creator_sandbox_orders set next_check_at=now()+interval '10 seconds' where id=p_order and buyer_id=actor and next_check_at<=now();
 return found;
end $$;
create function public.get_my_creator_order_file(p_order uuid) returns jsonb language sql stable security definer set search_path='' as $$
 with actor as materialized(select snoozer.verified_user() as id)
 select jsonb_build_object('orderId',o.id,'versionId',v.id,'sha256',v.sha256,'productId',d.id,'id',f.id,'scope',f.media_scope,'bytes',v.bytes,'state',f.state)
 from actor join snoozer.creator_sandbox_orders o on o.buyer_id=actor.id
 join snoozer.product_versions v on v.id=o.version_id join snoozer.product_drafts d on d.id=v.product_id and d.profile_id=o.profile_id and d.owner_id=o.seller_id
 join snoozer.product_files f on f.id=v.file_id and f.product_id=d.id and f.bytes=v.bytes and f.state='ready'
 join snoozer.profiles p on p.id=o.profile_id and p.owner_id=o.seller_id and p.media_scope=f.media_scope
 where o.id=p_order and o.state='paid' and cardinality(o.holds)=0 and o.access_until>now()
  and o.provider_checked_at>now()-interval '30 seconds'
$$;
create or replace function public.list_my_creator_sandbox_orders() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 return coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'versionId',o.version_id,'title',v.title,'amount',v.amount,'currency',v.currency,
  'state',o.state,'held',cardinality(o.holds)>0,'accessUntil',o.access_until,'createdAt',o.created_at,
  'accessActive',o.state='paid' and cardinality(o.holds)=0 and o.access_until>now()) order by o.created_at desc,o.id)
  from snoozer.creator_sandbox_orders o join snoozer.product_versions v on v.id=o.version_id where buyer_id=actor),'[]'::jsonb);
end $$;
revoke execute on function snoozer.stamp_creator_sandbox_check(),public.owns_my_creator_sandbox_order(uuid),public.claim_my_creator_order_check(uuid),public.get_my_creator_order_file(uuid) from public,anon,authenticated,service_role;
grant execute on function public.owns_my_creator_sandbox_order(uuid),public.claim_my_creator_order_check(uuid),public.get_my_creator_order_file(uuid) to authenticated;
commit;
