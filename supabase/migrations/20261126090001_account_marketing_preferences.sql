begin;

create table snoozer.account_marketing_preferences (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  email_opt_in boolean not null default false,
  consent_updated_at timestamptz not null default now()
);
alter table snoozer.account_marketing_preferences enable row level security;
revoke all on snoozer.account_marketing_preferences from public, anon, authenticated, service_role;
comment on table snoozer.account_marketing_preferences is
  'Private, owner-scoped opt-in state for Snoozer product news and offers. No message content or delivery address is stored here.';

create function public.get_my_marketing_preference() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
begin
  return jsonb_build_object(
    'emailOptIn', coalesce((select email_opt_in from snoozer.account_marketing_preferences where owner_id = actor), false),
    'consentUpdatedAt', (select consent_updated_at from snoozer.account_marketing_preferences where owner_id = actor)
  );
end $$;

create function public.set_my_marketing_preference(p_email_opt_in boolean) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
declare changed_at timestamptz;
begin
  if p_email_opt_in is null then raise exception 'Invalid preference' using errcode = '22023'; end if;
  insert into snoozer.account_marketing_preferences(owner_id, email_opt_in, consent_updated_at)
    values(actor, p_email_opt_in, now())
  on conflict(owner_id) do update set email_opt_in = excluded.email_opt_in, consent_updated_at = excluded.consent_updated_at
  returning consent_updated_at into changed_at;
  return changed_at;
end $$;

revoke execute on function public.get_my_marketing_preference(), public.set_my_marketing_preference(boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.get_my_marketing_preference(), public.set_my_marketing_preference(boolean)
  to authenticated;

commit;
