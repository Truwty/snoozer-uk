alter table snoozer.stripe_sandbox_expired_checkouts
  drop constraint stripe_sandbox_expired_checkouts_pkey,
  alter column session_id drop not null,
  add primary key (attempt_id),
  add unique (session_id);

create function public.get_stale_stripe_sandbox_checkout(p_owner uuid)
returns table(id uuid, customer_id text, created_epoch bigint, expires_epoch bigint)
language sql stable security definer set search_path = '' as $$
  select a.id, a.customer_id, extract(epoch from a.created_at)::bigint,
         extract(epoch from a.created_at + interval '2 hours')::bigint
  from snoozer.stripe_sandbox_checkout_attempts a
  where a.owner_id = p_owner and a.session_id is null and a.expired_at is null
    and a.created_at <= now() - interval '2 hours 5 minutes'
$$;

create function public.retire_unsaved_stripe_sandbox_checkout(
  p_owner uuid, p_attempt uuid, p_customer text, p_expired_session text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  attempt snoozer.stripe_sandbox_checkout_attempts;
begin
  if p_expired_session is not null and (p_customer is null or p_expired_session !~ '^cs_test_[A-Za-z0-9]{1,128}$') then
    return false;
  end if;
  update snoozer.stripe_sandbox_checkout_attempts set expired_at = now()
  where owner_id = p_owner and id = p_attempt and customer_id is not distinct from p_customer
    and session_id is null and subscription_id is null and expired_at is null
    and created_at <= now() - interval '2 hours 5 minutes'
  returning * into attempt;
  if not found then return false; end if;

  insert into snoozer.stripe_sandbox_expired_checkouts(session_id, attempt_id, owner_id, price_id, expired_at)
  values (p_expired_session, attempt.id, attempt.owner_id, attempt.price_id, attempt.expired_at);
  return true;
end
$$;

create or replace function public.bind_stripe_sandbox_checkout(p_owner uuid, p_attempt uuid, p_customer text, p_session text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_customer is null then return false; end if;

  update snoozer.stripe_sandbox_checkout_attempts
  set customer_id = p_customer, session_id = coalesce(session_id, p_session)
  where id = p_attempt and owner_id = p_owner and expired_at is null
    and (customer_id is null or customer_id = p_customer)
    and (p_session is null or (customer_id = p_customer and (session_id is null or session_id = p_session)));
  return found;
end
$$;

revoke execute on function public.get_stale_stripe_sandbox_checkout(uuid),
  public.retire_unsaved_stripe_sandbox_checkout(uuid,uuid,text,text) from public, anon, authenticated, service_role;
grant execute on function public.get_stale_stripe_sandbox_checkout(uuid),
  public.retire_unsaved_stripe_sandbox_checkout(uuid,uuid,text,text) to service_role;
