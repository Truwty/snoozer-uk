-- Authenticated, verified account self-service download of its own current private media.
-- Prefixes are derived from private profiles, NEVER accepted from the caller.
-- This exposes files in the account's current scopes only; historic/orphaned files
-- and external processor files remain subject to reviewed fulfilment.
create or replace function public.my_private_media_export_manifest()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid := snoozer.privacy_actor(); results jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object(
  'bucket',x.bucket_id,'name',x.name,'created_at',x.created_at)
  order by x.created_at,x.bucket_id,x.name),'[]'::jsonb)
 into results from (
   select o.bucket_id,o.name,o.created_at
   from storage.objects o
   join snoozer.profiles p
     on p.owner_id=actor and split_part(o.name,'/',1)=p.media_scope::text
   where o.bucket_id in ('avatar-incoming','avatar-images','gallery-incoming','gallery-images')
     and o.name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}[.](webp|upload)$'
   order by o.created_at,o.bucket_id,o.name
   limit 500
 ) x;
 return results;
end $$;

create or replace function public.my_private_media_export_allowed(p_bucket text,p_name text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare actor uuid := snoozer.privacy_actor();
begin
 if p_bucket not in ('avatar-incoming','avatar-images','gallery-incoming','gallery-images')
    or p_name is null or char_length(p_name)>100
    or p_name !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}[.](webp|upload)$'
 then return false; end if;
 return exists(
  select 1 from storage.objects o
  join snoozer.profiles p
    on p.owner_id=actor and split_part(o.name,'/',1)=p.media_scope::text
  where o.bucket_id=p_bucket and o.name=p_name
 );
end $$;

revoke all on function public.my_private_media_export_manifest(),
  public.my_private_media_export_allowed(text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.my_private_media_export_manifest(),
  public.my_private_media_export_allowed(text,text) to authenticated;
