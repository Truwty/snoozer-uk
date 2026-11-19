begin;
create table snoozer.creator_sandbox_receipts (
 id text primary key check(id ~ '^evt_[A-Za-z0-9]{1,128}$'),
 platform_id text not null check(platform_id ~ '^acct_[A-Za-z0-9]{1,128}$'),
 account_id text not null references snoozer.creator_sandbox_accounts(account_id) on delete restrict,
 type text not null, object_id text not null, occurred_at timestamptz not null,
 received_at timestamptz not null default now(), processed_at timestamptz,
 order_id uuid references snoozer.creator_sandbox_orders(id) on delete set null,
 check(account_id<>platform_id),
 check((type in ('checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired') and object_id ~ '^cs_test_[A-Za-z0-9]{1,255}$')
  or (type='charge.refunded' and object_id ~ '^ch_[A-Za-z0-9]{1,128}$')
  or (type in ('charge.dispute.created','charge.dispute.updated','charge.dispute.closed') and object_id ~ '^du_[A-Za-z0-9]{1,128}$')
  or (type in ('radar.early_fraud_warning.created','radar.early_fraud_warning.updated') and object_id ~ '^issfr_[A-Za-z0-9]{1,128}$'))
);
create index creator_receipts_account on snoozer.creator_sandbox_receipts(account_id,received_at);
create index creator_receipts_order on snoozer.creator_sandbox_receipts(order_id);
create index creator_receipts_pending on snoozer.creator_sandbox_receipts(received_at,id) where processed_at is null;
alter table snoozer.creator_sandbox_receipts enable row level security;
revoke all on snoozer.creator_sandbox_receipts from public,anon,authenticated,service_role;

create function public.record_creator_sandbox_receipt(p_id text,p_platform text,p_account text,p_type text,p_object text,p_occurred_at timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
declare existing snoozer.creator_sandbox_receipts;
begin
 -- Ignore another platform seller's events, even if they share this destination.
 perform 1 from snoozer.creator_sandbox_accounts where platform_id=p_platform and account_id=p_account for update;
 if not found then return false; end if;
 select * into existing from snoozer.creator_sandbox_receipts where id=p_id;
 if found then
  if existing.platform_id<>p_platform or existing.account_id<>p_account or existing.type<>p_type or existing.object_id<>p_object or existing.occurred_at<>p_occurred_at then
   raise exception 'Receipt identity conflict' using errcode='40001';
  end if;
  return true;
 end if;
 if p_occurred_at is null or not isfinite(p_occurred_at) or p_occurred_at>now()+interval '5 minutes'
  or p_occurred_at<timestamp with time zone '2000-01-01' then raise exception 'Invalid receipt time' using errcode='22023'; end if;
 if (select count(*) from snoozer.creator_sandbox_receipts where account_id=p_account)>=10000 then raise exception 'Receipt retention limit reached' using errcode='P1221'; end if;
 insert into snoozer.creator_sandbox_receipts(id,platform_id,account_id,type,object_id,occurred_at) values(p_id,p_platform,p_account,p_type,p_object,p_occurred_at);
 return true;
end $$;

create function public.recover_creator_sandbox_checkout(p_order uuid,p_receipt text,p_checkout text,p_created timestamptz,p_expires timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
declare receipt snoozer.creator_sandbox_receipts; item snoozer.creator_sandbox_orders;
begin
 select * into receipt from snoozer.creator_sandbox_receipts where id=p_receipt for update;
 if not found or receipt.type not like 'checkout.session.%' or receipt.object_id is distinct from p_checkout then return false; end if;
 select * into item from snoozer.creator_sandbox_orders where id=p_order and platform_id=receipt.platform_id and account_id=receipt.account_id for update;
 if not found or (receipt.order_id is not null and receipt.order_id<>item.id) then return false; end if;
 if item.checkout_id is not null then return item.checkout_id=p_checkout and item.checkout_expires_at=p_expires; end if;
 -- This binds a canonically retrieved old session; it never retries creation beyond idempotency retention.
 if item.state<>'pending' or p_created is null or p_expires is null or p_created<item.created_at-interval '5 seconds'
  or p_created>item.created_at+interval '23 hours' or p_expires<item.created_at+interval '30 minutes' or p_expires>item.created_at+interval '24 hours' then return false; end if;
 update snoozer.creator_sandbox_orders set checkout_id=p_checkout,checkout_expires_at=p_expires where id=item.id;
 return true;
end $$;

create function public.reconcile_creator_sandbox_order(p_order uuid,p_platform text,p_account text,p_checkout text,p_payment text,p_charge text,p_state text,p_holds text[],p_receipt text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item snoozer.creator_sandbox_orders; receipt snoozer.creator_sandbox_receipts; paid timestamptz;
begin
 if p_receipt is not null then
  select * into receipt from snoozer.creator_sandbox_receipts where id=p_receipt for update;
  if not found or receipt.platform_id is distinct from p_platform or receipt.account_id is distinct from p_account
   or (receipt.order_id is not null and receipt.order_id<>p_order)
   or (receipt.type like 'checkout.session.%' and receipt.object_id is distinct from p_checkout)
   or (receipt.type='charge.refunded' and receipt.object_id is distinct from p_charge) then raise exception 'Receipt scope mismatch' using errcode='40001'; end if;
 end if;
 select * into item from snoozer.creator_sandbox_orders where id=p_order for update;
 if not found or item.platform_id is distinct from p_platform or item.account_id is distinct from p_account or item.checkout_id is null
  or item.checkout_id is distinct from p_checkout then raise exception 'Order scope mismatch' using errcode='40001'; end if;
 if p_state is null or p_state not in ('pending','paid','expired') or p_holds is null or not(p_holds<@array['refund','dispute','fraud']::text[])
  or array_position(p_holds,null) is not null or cardinality(p_holds)>3
  or (p_payment is not null and p_payment !~ '^pi_[A-Za-z0-9]{1,128}$') or (p_charge is not null and p_charge !~ '^ch_[A-Za-z0-9]{1,128}$')
  or (p_state='paid' and (p_payment is null or p_charge is null)) then raise exception 'Invalid payment proof' using errcode='22023'; end if;
 if (item.payment_id is not null and item.payment_id is distinct from p_payment) or (item.charge_id is not null and item.charge_id is distinct from p_charge) then
  raise exception 'Payment identity conflict' using errcode='40001';
 end if;
 paid:=case when p_state='paid' then coalesce(item.paid_at,now()) else item.paid_at end;
 update snoozer.creator_sandbox_orders set
  state=case when item.state='paid' or p_state='paid' then 'paid' when item.state='expired' or p_state='expired' then 'expired' else 'pending' end,
  payment_id=coalesce(item.payment_id,p_payment),charge_id=coalesce(item.charge_id,p_charge),paid_at=paid,
  access_until=coalesce(item.access_until,paid+interval '30 days'),
  retained_until=greatest(item.retained_until,paid+interval '90 days'),
  holds=array(select distinct h from unnest(item.holds||p_holds) h order by h)
 where id=item.id;
 if p_receipt is not null then update snoozer.creator_sandbox_receipts set order_id=item.id,processed_at=coalesce(processed_at,now()) where id=p_receipt; end if;
 return snoozer.creator_sandbox_order_json(item.id);
end $$;

create function public.ignore_creator_sandbox_receipt(p_id text,p_platform text,p_account text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 update snoozer.creator_sandbox_receipts set processed_at=coalesce(processed_at,now()) where id=p_id and platform_id=p_platform and account_id=p_account and order_id is null;
 return found;
end $$;
revoke execute on function public.record_creator_sandbox_receipt(text,text,text,text,text,timestamptz),public.recover_creator_sandbox_checkout(uuid,text,text,timestamptz,timestamptz),
 public.reconcile_creator_sandbox_order(uuid,text,text,text,text,text,text,text[],text),public.ignore_creator_sandbox_receipt(text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.record_creator_sandbox_receipt(text,text,text,text,text,timestamptz),public.recover_creator_sandbox_checkout(uuid,text,text,timestamptz,timestamptz),
 public.reconcile_creator_sandbox_order(uuid,text,text,text,text,text,text,text[],text),public.ignore_creator_sandbox_receipt(text,text,text) to service_role;
commit;
