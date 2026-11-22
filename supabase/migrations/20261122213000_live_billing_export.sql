-- Verified account may obtain its own Stripe customer reference for read-only export.
-- No other customer, billing gateway credentials or provider financial data exposed.
create or replace function public.my_premium_live_export_customer()
returns text language plpgsql stable security definer set search_path='' as $$
declare actor uuid := snoozer.privacy_actor();
begin
 return (select c.customer_id from snoozer.premium_live_customers c
   where c.owner_id=actor);
end $$;
revoke all on function public.my_premium_live_export_customer()
 from public,anon,authenticated,service_role;
grant execute on function public.my_premium_live_export_customer() to authenticated;
