begin;
-- Add fields to the existing buyer-owned projection; no entitlement or state changes.
create or replace function public.list_my_creator_sandbox_orders() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 return coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'versionId',o.version_id,'title',v.title,'amount',coalesce(o.charged_amount,v.amount),'currency',v.currency,
  'originalAmount',v.amount,'paidAt',o.paid_at,'holds',o.holds,
  'state',o.state,'held',cardinality(o.holds)>0,'accessUntil',o.access_until,'createdAt',o.created_at,
  'accessActive',o.state='paid' and cardinality(o.holds)=0 and o.access_until>now()) order by o.created_at desc,o.id)
  from snoozer.creator_sandbox_orders o join snoozer.product_versions v on v.id=o.version_id where buyer_id=actor),'[]'::jsonb);
end $$;
revoke execute on function public.list_my_creator_sandbox_orders() from public,anon,authenticated,service_role;
grant execute on function public.list_my_creator_sandbox_orders() to authenticated;
commit;
