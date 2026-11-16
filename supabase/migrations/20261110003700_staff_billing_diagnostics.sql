create table snoozer.staff_roles (
  owner_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role = 'billing_diagnostics'),
  granted_at timestamptz not null default now(),
  primary key (owner_id,role)
);
alter table snoozer.staff_roles enable row level security;
revoke all on snoozer.staff_roles from public, anon, authenticated, service_role;

create table snoozer.billing_diagnostics_access (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  accessed_at timestamptz not null default now()
);
alter table snoozer.billing_diagnostics_access enable row level security;
revoke all on snoozer.billing_diagnostics_access from public, anon, authenticated, service_role;

create function public.can_read_billing_diagnostics()
returns boolean language sql stable security definer set search_path = '' as $$
  with actor as materialized (select snoozer.verified_user() as id)
  select exists (
    select 1 from actor join snoozer.staff_roles s on s.owner_id = actor.id where s.role = 'billing_diagnostics'
  )
$$;

create function public.read_staff_billing_diagnostics()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := snoozer.verified_user();
begin
  perform 1 from snoozer.staff_roles where owner_id = actor and role = 'billing_diagnostics' for share;
  if not found then raise exception 'Billing diagnostics role required' using errcode = '42501'; end if;
  insert into snoozer.billing_diagnostics_access(actor_id) values (actor);
  return public.get_billing_diagnostics();
end
$$;

revoke execute on function public.can_read_billing_diagnostics(), public.read_staff_billing_diagnostics()
  from public, anon, authenticated, service_role;
grant execute on function public.can_read_billing_diagnostics(), public.read_staff_billing_diagnostics() to authenticated;
