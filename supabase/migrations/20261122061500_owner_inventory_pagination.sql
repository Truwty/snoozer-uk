-- Owner-only cursor pagination over complete account and profile inventories.
-- Private account emails remain accessible only via a verified Owner RPC.
create function public.owner_user_search_page(
 p_query text default '', p_before_created timestamptz default null,
 p_before_id uuid default null, p_limit integer default 50
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor();
begin
 if char_length(coalesce(p_query,''))>120
    or (p_before_created is null) <> (p_before_id is null) then
   raise exception 'Invalid search cursor' using errcode='22023';
 end if;
 return coalesce((select jsonb_agg(to_jsonb(a)) from (
  select u.id,u.email,u.email_confirmed_at is not null as verified,u.created_at,
    (select count(*) from snoozer.profiles p where p.owner_id=u.id) as profile_count,
    exists(select 1 from snoozer.account_restrictions r where r.user_id=u.id
      and r.revoked_at is null and (r.ends_at is null or r.ends_at>now())) as restricted,
    exists(select 1 from snoozer.platform_owners o where o.owner_id=u.id) as is_owner
  from auth.users u
  where (coalesce(p_query,'')='' or u.id::text=p_query
    or u.email ilike '%'||replace(replace(replace(p_query,chr(92),chr(92)||chr(92)),'%',chr(92)||'%'),'_',chr(92)||'_')||'%' escape chr(92)
    or exists(select 1 from snoozer.profiles p where p.owner_id=u.id
      and p.username ilike '%'||replace(replace(replace(p_query,chr(92),chr(92)||chr(92)),'%',chr(92)||'%'),'_',chr(92)||'_')||'%' escape chr(92)))
   and (p_before_created is null or (u.created_at,u.id)<(p_before_created,p_before_id))
  order by u.created_at desc,u.id desc
  limit least(greatest(coalesce(p_limit,50),1),100)
 ) a),'[]'::jsonb);
end $$;
revoke all on function public.owner_user_search_page(text,timestamptz,uuid,integer)
 from public,anon,authenticated,service_role;
grant execute on function public.owner_user_search_page(text,timestamptz,uuid,integer) to authenticated;

create function public.owner_profile_inventory_page(
 p_query text default '', p_before_created timestamptz default null,
 p_before_id uuid default null, p_limit integer default 50
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor();
begin
 if char_length(coalesce(p_query,''))>120
    or (p_before_created is null) <> (p_before_id is null) then
   raise exception 'Invalid inventory cursor' using errcode='22023';
 end if;
 return coalesce((select jsonb_agg(to_jsonb(a)) from (
  select p.id,p.owner_id,p.username,p.display_name,p.published_revision is not null as published,p.created_at,
    exists(select 1 from snoozer.moderated_profiles m
      where m.profile_id=p.id and m.unblocked_at is null) as moderated
  from snoozer.profiles p
  where (coalesce(p_query,'')='' or p.username ilike
    '%'||replace(replace(replace(p_query,chr(92),chr(92)||chr(92)),'%',chr(92)||'%'),'_',chr(92)||'_')||'%' escape chr(92)
    or p.owner_id::text=p_query)
   and (p_before_created is null or (p.created_at,p.id)<(p_before_created,p_before_id))
  order by p.created_at desc,p.id desc
  limit least(greatest(coalesce(p_limit,50),1),100)
 ) a),'[]'::jsonb);
end $$;
revoke all on function public.owner_profile_inventory_page(text,timestamptz,uuid,integer)
 from public,anon,authenticated,service_role;
grant execute on function public.owner_profile_inventory_page(text,timestamptz,uuid,integer) to authenticated;
