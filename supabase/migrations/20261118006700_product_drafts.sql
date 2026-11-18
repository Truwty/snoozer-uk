begin;
create table snoozer.product_drafts (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 profile_id uuid not null references snoozer.profiles(id) on delete cascade,
 revision integer not null default 0 check(revision>=0),
 title text not null check(char_length(title) between 1 and 100 and title=btrim(title) and title !~ '[[:cntrl:]]'),
 description text not null default '' check(char_length(description)<=2000 and replace(replace(description,E'\n',''),E'\t','') !~ '[[:cntrl:]]'),
 amount integer not null check(amount between 50 and 100000),
 currency text not null default 'gbp' check(currency='gbp'),
 archived boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index product_drafts_owner on snoozer.product_drafts(owner_id,created_at,id);
create index product_drafts_profile on snoozer.product_drafts(profile_id);
alter table snoozer.product_drafts enable row level security;
revoke all on snoozer.product_drafts from public,anon,authenticated,service_role;

create function public.list_my_product_drafts(p_profile uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor) then raise exception 'Profile unavailable' using errcode='42501'; end if;
 return jsonb_build_object('activeLimit',5,'totalLimit',20,
  'activeUsed',(select count(*) from snoozer.product_drafts where owner_id=actor and not archived),
  'totalUsed',(select count(*) from snoozer.product_drafts where owner_id=actor),
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'revision',revision,'title',title,'description',description,'amount',amount,'archived',archived,'updatedAt',updated_at) order by archived,created_at,id)
   from snoozer.product_drafts where profile_id=p_profile and owner_id=actor),'[]'::jsonb));
end $$;

create function public.save_product_draft(p_profile uuid,p_id uuid,p_expected integer,p_title text,p_description text,p_amount integer,p_archived boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user(); item snoozer.product_drafts; result uuid;
begin
 -- The same account lock serializes profile deletion and catalogue-wide limits.
 perform 1 from auth.users where id=actor for update;
 if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor) then raise exception 'Profile unavailable' using errcode='42501'; end if;
 if p_title is null or char_length(btrim(p_title)) not between 1 and 100 or p_title ~ '[[:cntrl:]]'
  or p_description is null or char_length(p_description)>2000 or replace(replace(p_description,E'\n',''),E'\t','') ~ '[[:cntrl:]]'
  or p_amount is null or p_amount not between 50 and 100000 or p_archived is null or p_expected is null or p_expected not between 0 and 2147483646 then
  raise exception 'Invalid product draft' using errcode='22023';
 end if;
 if p_id is not null then
  select * into item from snoozer.product_drafts where id=p_id and profile_id=p_profile and owner_id=actor for update;
  if not found then raise exception 'Product unavailable' using errcode='42501'; end if;
  if item.revision<>p_expected then raise exception 'Product revision changed' using errcode='40001'; end if;
 elsif p_expected<>0 then raise exception 'Invalid initial revision' using errcode='22023';
 elsif (select count(*) from snoozer.product_drafts where owner_id=actor)>=20 then raise exception 'Catalogue total limit reached' using errcode='P1201';
 end if;
 if not p_archived and (p_id is null or item.archived) and (select count(*) from snoozer.product_drafts where owner_id=actor and not archived)>=5 then
  raise exception 'Active catalogue limit reached' using errcode='P1201';
 end if;
 if p_id is null then
  insert into snoozer.product_drafts(owner_id,profile_id,title,description,amount,archived) values(actor,p_profile,btrim(p_title),p_description,p_amount,p_archived) returning id into result;
 else
  update snoozer.product_drafts set title=btrim(p_title),description=p_description,amount=p_amount,archived=p_archived,revision=revision+1,updated_at=now() where id=p_id returning id into result;
 end if;
 return result;
end $$;
revoke execute on function public.list_my_product_drafts(uuid),public.save_product_draft(uuid,uuid,integer,text,text,integer,boolean) from public,anon,authenticated,service_role;
grant execute on function public.list_my_product_drafts(uuid),public.save_product_draft(uuid,uuid,integer,text,text,integer,boolean) to authenticated;
commit;
