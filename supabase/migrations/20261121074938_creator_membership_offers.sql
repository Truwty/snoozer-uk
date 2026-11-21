begin;
-- Editorial proposals only, never subscription or entitlement records.
create table snoozer.creator_membership_offers (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references snoozer.profiles(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 revision integer not null default 0 check(revision>=0),
 title text not null check(char_length(title) between 1 and 100 and btrim(title)=title and title !~ '[[:cntrl:]]'),
 benefits text not null check(char_length(benefits)<=500 and replace(replace(benefits,E'\n',''),E'\t','') !~ '[[:cntrl:]]'),
 monthly_pence integer not null check(monthly_pence between 100 and 10000),
 visible boolean not null default false,
 created_at timestamptz not null default now(),
 check(not visible or char_length(btrim(benefits,E' \n\t'))>0)
);
create index creator_membership_profile on snoozer.creator_membership_offers(profile_id,owner_id);
alter table snoozer.creator_membership_offers enable row level security;
revoke all on snoozer.creator_membership_offers from public,anon,authenticated,service_role;

create function public.list_my_creator_membership_offers(p_profile uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor)
 then raise exception 'Profile unavailable' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'revision',revision,'title',title,'benefits',benefits,'monthlyPence',monthly_pence,'visible',visible) order by created_at,id)
 from snoozer.creator_membership_offers where profile_id=p_profile and owner_id=actor),'[]'::jsonb);
end $$;

create function public.save_my_creator_membership_offer(p_profile uuid,p_id uuid,p_revision integer,p_title text,p_benefits text,p_monthly integer,p_visible boolean,p_remove boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user(); item snoozer.creator_membership_offers; result uuid;
begin
 perform 1 from auth.users where id=actor for update;
 if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor)
 then raise exception 'Profile unavailable' using errcode='42501'; end if;
 if p_revision is null or p_revision not between 0 and 2147483646 or p_remove is null
 then raise exception 'Invalid revision' using errcode='22023'; end if;
 if p_id is not null then
  select * into item from snoozer.creator_membership_offers where id=p_id and profile_id=p_profile and owner_id=actor for update;
  if not found then raise exception 'Offer unavailable' using errcode='42501'; end if;
  if item.revision<>p_revision then raise exception 'Offer changed' using errcode='40001'; end if;
  if p_remove then
   delete from snoozer.creator_membership_offers where id=p_id;
   return p_id;
  end if;
 elsif p_remove or p_revision<>0 then raise exception 'Invalid new offer' using errcode='22023';
 end if;
 if p_title is null or char_length(p_title) not between 1 and 100 or btrim(p_title)<>p_title or p_title ~ '[[:cntrl:]]'
 or p_benefits is null or char_length(p_benefits)>500 or replace(replace(p_benefits,E'\n',''),E'\t','') ~ '[[:cntrl:]]'
 or p_monthly is null or p_monthly not between 100 and 10000 or p_visible is null
 or (p_visible and char_length(btrim(p_benefits,E' \n\t'))=0)
 then raise exception 'Invalid membership proposal' using errcode='22023'; end if;
 if p_id is null then
  if (select count(*) from snoozer.creator_membership_offers where profile_id=p_profile and owner_id=actor)>=5
  then raise exception 'Membership offer limit reached' using errcode='P1226'; end if;
  insert into snoozer.creator_membership_offers(profile_id,owner_id,title,benefits,monthly_pence,visible)
   values(p_profile,actor,p_title,p_benefits,p_monthly,p_visible) returning id into result;
 else
  update snoozer.creator_membership_offers set title=p_title,benefits=p_benefits,monthly_pence=p_monthly,visible=p_visible,revision=revision+1
   where id=p_id returning id into result;
 end if;
 return result;
end $$;

create function public.get_creator_sandbox_membership_offers(p_name text) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'title',m.title,'benefits',m.benefits,'monthlyPence',m.monthly_pence) order by m.created_at,m.id),'[]'::jsonb)
 from snoozer.creator_membership_offers m join snoozer.profiles p on p.id=m.profile_id and p.owner_id=m.owner_id
 where p.username::text=p_name and m.visible and jsonb_array_length(coalesce(public.get_creator_sandbox_store(p_name)->'items','[]'::jsonb))>0
$$;
revoke execute on function public.list_my_creator_membership_offers(uuid),public.save_my_creator_membership_offer(uuid,uuid,integer,text,text,integer,boolean,boolean),public.get_creator_sandbox_membership_offers(text) from public,anon,authenticated,service_role;
grant execute on function public.list_my_creator_membership_offers(uuid),public.save_my_creator_membership_offer(uuid,uuid,integer,text,text,integer,boolean,boolean) to authenticated;
grant execute on function public.get_creator_sandbox_membership_offers(text) to anon,authenticated;
commit;
