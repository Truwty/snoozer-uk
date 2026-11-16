alter table snoozer.kofi_donation_receipts add column claimed_at timestamptz;

create table snoozer.kofi_donation_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  transaction_ref text not null check (transaction_ref ~ '^[A-Za-z0-9_-]{1,128}$'),
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','confirmed','declined')),
  reviewed_at timestamptz,
  receipt_id uuid unique references snoozer.kofi_donation_receipts(message_id),
  unique(owner_id,transaction_ref),
  check ((status = 'pending') = (reviewed_at is null)),
  check ((status = 'confirmed') = (receipt_id is not null))
);
create index kofi_pending_reviews on snoozer.kofi_donation_reviews(created_at, id) where status = 'pending';
alter table snoozer.kofi_donation_reviews enable row level security;
revoke all on snoozer.kofi_donation_reviews from public, anon, authenticated, service_role;

create function public.request_kofi_donation_review(p_reference text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := snoozer.verified_user();
begin
  if p_reference is null or p_reference !~ '^[A-Za-z0-9_-]{1,128}$' then return 'invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended('kofi-review:' || actor::text, 0));
  if exists (select 1 from snoozer.kofi_donation_reviews where owner_id = actor and transaction_ref = p_reference) then
    return 'received';
  end if;
  if (select count(*) from snoozer.kofi_donation_reviews
      where owner_id = actor and created_at >= now() - interval '1 day') >= 3 then
    return 'limited';
  end if;
  insert into snoozer.kofi_donation_reviews(owner_id,transaction_ref) values (actor,p_reference);
  return 'received';
end
$$;

create function public.list_my_kofi_donation_reviews()
returns table(reference text, status text, requested_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with actor as materialized (select snoozer.verified_user() as id)
  select r.transaction_ref,r.status,r.created_at from actor
  join snoozer.kofi_donation_reviews r on r.owner_id = actor.id
  order by r.created_at desc,r.id limit 20
$$;

create function public.list_pending_kofi_donation_reviews()
returns table(review_id uuid, owner_id uuid, reference text, requested_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id,r.owner_id,r.transaction_ref,r.created_at from snoozer.kofi_donation_reviews r
  where r.status = 'pending' order by r.created_at,r.id limit 50
$$;

create function public.resolve_kofi_donation_review(p_review uuid, p_confirmed boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  candidate snoozer.kofi_donation_reviews;
  matched_receipt uuid;
begin
  if p_confirmed is null then return false; end if;
  select * into candidate from snoozer.kofi_donation_reviews
  where id = p_review and status = 'pending' for update;
  if not found then return false; end if;
  if p_confirmed then
    update snoozer.kofi_donation_receipts set claimed_at = now()
    where transaction_id = candidate.transaction_ref and claimed_at is null
    returning message_id into matched_receipt;
    if not found then return false; end if;
  end if;
  update snoozer.kofi_donation_reviews
  set status = case when p_confirmed then 'confirmed' else 'declined' end,
      reviewed_at = now(), receipt_id = matched_receipt
  where id = candidate.id;
  return true;
end
$$;

revoke execute on function public.request_kofi_donation_review(text), public.list_my_kofi_donation_reviews(),
  public.list_pending_kofi_donation_reviews(), public.resolve_kofi_donation_review(uuid,boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.request_kofi_donation_review(text), public.list_my_kofi_donation_reviews() to authenticated;
grant execute on function public.list_pending_kofi_donation_reviews(), public.resolve_kofi_donation_review(uuid,boolean) to service_role;
