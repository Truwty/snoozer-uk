begin;

-- Store-level transparency only: no Checkout, product, receipt or buyer changes.
create table snoozer.creator_affiliate_disclosures (
  profile_id uuid primary key references snoozer.profiles(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  revision integer not null default 0 check(revision>=0),
  disclosure text not null check(char_length(disclosure)<=500 and replace(replace(disclosure,E'\n',''),E'\t','') !~ '[[:cntrl:]]'),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  check(not enabled or char_length(btrim(disclosure))>0)
);
alter table snoozer.creator_affiliate_disclosures enable row level security;
revoke all on snoozer.creator_affiliate_disclosures from public,anon,authenticated,service_role;

create function public.get_my_creator_affiliate_disclosure(p_profile uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 if p_profile is null or not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor)
 then raise exception 'Profile unavailable' using errcode='42501'; end if;
 return coalesce((
   select jsonb_build_object('revision',d.revision,'disclosure',d.disclosure,'enabled',d.enabled)
   from snoozer.creator_affiliate_disclosures d where d.profile_id=p_profile and d.owner_id=actor
 ),jsonb_build_object('revision',0,'disclosure','','enabled',false));
end $$;

create function public.save_my_creator_affiliate_disclosure(p_profile uuid,p_expected integer,p_disclosure text,p_enabled boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user(); item snoozer.creator_affiliate_disclosures;
begin
 perform 1 from auth.users where id=actor for update;
 if p_profile is null or not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor)
 then raise exception 'Profile unavailable' using errcode='42501'; end if;
 if p_expected is null or p_expected<0 or p_expected>2147483646
  or p_disclosure is null or char_length(p_disclosure)>500
  or replace(replace(p_disclosure,E'\n',''),E'\t','') ~ '[[:cntrl:]]'
  or p_enabled is null or (p_enabled and char_length(btrim(p_disclosure))=0)
 then raise exception 'Invalid affiliate disclosure' using errcode='22023'; end if;
 select * into item from snoozer.creator_affiliate_disclosures
   where profile_id=p_profile and owner_id=actor for update;
 if not found then
   if p_expected<>0 then raise exception 'Disclosure changed' using errcode='40001'; end if;
   insert into snoozer.creator_affiliate_disclosures(profile_id,owner_id,disclosure,enabled)
   values(p_profile,actor,p_disclosure,p_enabled);
 else
   if item.revision<>p_expected then raise exception 'Disclosure changed' using errcode='40001'; end if;
   update snoozer.creator_affiliate_disclosures
      set disclosure=p_disclosure,enabled=p_enabled,revision=revision+1,updated_at=now()
      where profile_id=p_profile and owner_id=actor;
 end if;
 return true;
end $$;

-- A disclosure cannot make an unavailable private storefront visible. Return
-- only the publicly enabled text, and only when the canonical sandbox store
-- itself is eligible; never expose owner IDs or private draft fields.
create function public.get_creator_sandbox_affiliate_disclosure(p_name text)
returns text language sql stable security definer set search_path='' as $$
 select d.disclosure
 from snoozer.creator_affiliate_disclosures d
 join snoozer.profiles p on p.id=d.profile_id and p.owner_id=d.owner_id and p.username::text=p_name
 where d.enabled and public.get_creator_sandbox_store(p_name) is not null
$$;

revoke execute on function public.get_my_creator_affiliate_disclosure(uuid),
  public.save_my_creator_affiliate_disclosure(uuid,integer,text,boolean),
  public.get_creator_sandbox_affiliate_disclosure(text)
  from public,anon,authenticated,service_role;
grant execute on function public.get_my_creator_affiliate_disclosure(uuid),
  public.save_my_creator_affiliate_disclosure(uuid,integer,text,boolean) to authenticated;
grant execute on function public.get_creator_sandbox_affiliate_disclosure(text) to anon,authenticated;

commit;
