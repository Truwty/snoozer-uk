begin;

create or replace function public.get_public_discovery_collection(
  p_slug text,p_request_fingerprint text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform snoozer.consume_discovery_request(p_request_fingerprint);
  if p_slug is null or length(p_slug)>48 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Invalid collection slug' using errcode='22023';
  end if;
  return (
    select item from jsonb_array_elements(public.get_public_discovery_collections(20,p_request_fingerprint)) item
    where item->>'slug'=p_slug limit 1
  );
end
$$;

create or replace function public.owner_delete_discovery_collection(p_slug text,p_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.admin_actor(true);
begin
  if p_slug is null or length(p_slug)>48 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or length(btrim(coalesce(p_reason,''))) not between 8 and 500 then
    raise exception 'Invalid collection removal' using errcode='22023';
  end if;
  delete from snoozer.discovery_collections where slug=p_slug;
  if not found then return false; end if;
  insert into snoozer.admin_audit_events(actor_id,action,reason,details)
  values(actor,'discovery.collection.delete',p_reason,jsonb_build_object('slug',p_slug));
  return true;
end
$$;

commit;
