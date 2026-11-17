alter table snoozer.kofi_donation_receipts
  add column currency text not null default 'GBP' check (currency in ('GBP', 'USD'));

comment on column snoozer.kofi_donation_receipts.amount_pence is
  'Amount in the minor unit of currency (GBP pence or USD cents). The legacy column name is retained.';

create function public.record_kofi_donation_in_currency(
  p_message uuid, p_transaction text, p_occurred_at timestamptz, p_amount integer, p_currency text
)
returns void language sql security definer set search_path = '' as $$
  insert into snoozer.kofi_donation_receipts(message_id, transaction_id, occurred_at, amount_pence, currency)
  values (p_message, p_transaction, p_occurred_at, p_amount, p_currency)
  on conflict do nothing
$$;

revoke execute on function public.record_kofi_donation_in_currency(uuid,text,timestamptz,integer,text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_kofi_donation_in_currency(uuid,text,timestamptz,integer,text)
  to service_role;
