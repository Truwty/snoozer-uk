create table snoozer.kofi_donation_receipts (
  message_id uuid primary key,
  transaction_id text not null unique check (char_length(transaction_id) between 1 and 128),
  occurred_at timestamptz not null,
  amount_pence integer not null check (amount_pence between 1 and 99999999),
  received_at timestamptz not null default now()
);

alter table snoozer.kofi_donation_receipts enable row level security;
revoke all on snoozer.kofi_donation_receipts from public, anon, authenticated, service_role;

create function public.record_kofi_donation(p_message uuid, p_transaction text, p_occurred_at timestamptz, p_amount integer)
returns void language sql security definer set search_path = '' as $$
  insert into snoozer.kofi_donation_receipts(message_id, transaction_id, occurred_at, amount_pence)
  values (p_message, p_transaction, p_occurred_at, p_amount)
  on conflict do nothing
$$;

revoke execute on function public.record_kofi_donation(uuid,text,timestamptz,integer) from public, anon, authenticated, service_role;
grant execute on function public.record_kofi_donation(uuid,text,timestamptz,integer) to service_role;
