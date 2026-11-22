begin;

-- Strictly validate a bounded, versioned effect payload. Never accept arbitrary CSS or scripts.
create or replace function snoozer.valid_profile_appearance(p_value jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p_value) = 'object' then coalesce(
    p_value - array['layout','accent','entrance','backgroundImage','effects'] =
      jsonb_build_object('density',p_value->'density','corners',p_value->'corners')
    and p_value->>'density' in ('compact','balanced','airy')
    and p_value->>'corners' in ('square','soft','round')
    and (not p_value ? 'layout' or p_value->>'layout' in ('centred','editorial','portfolio'))
    and (not p_value ? 'accent' or p_value->>'accent' in ('theme','mint','rose','ink'))
    and (not p_value ? 'entrance' or p_value->>'entrance' in ('none','fade','rise'))
    and (not p_value ? 'backgroundImage' or
      (jsonb_typeof(p_value->'backgroundImage')='string'
       and lower(p_value->>'backgroundImage') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
    and (not p_value ? 'effects' or snoozer.valid_profile_effects(p_value->'effects')), false)
  else false end
$$;

create function snoozer.valid_profile_effects(e jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(e) = 'object' then coalesce(
    e - array['version','enabled','background','border','text','interaction','intensity','speed','preset'] = '{}'::jsonb
    and e ?& array['version','enabled','background','border','text','interaction','intensity','speed','preset']
    and jsonb_typeof(e->'version')='number' and e->>'version'='1'
    and jsonb_typeof(e->'enabled')='boolean'
    and e->>'background' in ('none','gradient','aurora','stars','snow','rain','mesh')
    and e->>'border' in ('none','glow','neon','gradient')
    and e->>'text' in ('none','typewriter','shimmer','glitch')
    and e->>'interaction' in ('none','tilt','spotlight','trail')
    and e->>'speed' in ('slow','normal','fast')
    and e->>'preset' in ('none','lagoon-dream','night-sky','frost','cyber','studio-nebula')
    and jsonb_typeof(e->'intensity')='number'
    and (e->>'intensity') ~ '^(0|[1-9][0-9]?)$|^100$', false)
  else false end
$$;

-- The appearance validator above references this function; PostgreSQL resolves SQL functions
-- during creation, so create the effects validator first in the migration execution.
create or replace function snoozer.valid_profile_appearance(p_value jsonb) returns boolean
language sql immutable set search_path = '' as $
 select case when jsonb_typeof(p_value)='object' then coalesce(
   p_value - array['layout','accent','entrance','backgroundImage','effects'] =
      jsonb_build_object('density',p_value->'density','corners',p_value->'corners')
   and p_value->>'density' in ('compact','balanced','airy')
   and p_value->>'corners' in ('square','soft','round')
   and (not p_value ? 'layout' or p_value->>'layout' in ('centred','editorial','portfolio'))
   and (not p_value ? 'accent' or p_value->>'accent' in ('theme','mint','rose','ink'))
   and (not p_value ? 'entrance' or p_value->>'entrance' in ('none','fade','rise'))
   and (not p_value ? 'backgroundImage' or
     (jsonb_typeof(p_value->'backgroundImage')='string' and lower(p_value->>'backgroundImage')
      ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(e jsonb, p_tier text) returns boolean
language sql immutable set search_path = '' as $$
 select case when e is null or e->>'enabled'='false' then true
 when e->>'background'='gradient' and e->>'border'='none' and e->>'text'='none' and e->>'interaction'='none' then true
 when p_tier not in ('plus','pro','studio') then false
 when e->>'interaction'<>'none' and p_tier='plus' then false
 when e->>'preset'='studio-nebula' and p_tier<>'studio' then false
 else (
    (case when e->>'background'<>'none' then 1 else 0 end)
   +(case when e->>'border'<>'none' then 1 else 0 end)
   +(case when e->>'text'<>'none' then 1 else 0 end)
   +(case when e->>'interaction'<>'none' then 1 else 0 end)
 ) <= case p_tier when 'plus' then 2 else 4 end
 end
$$;

create function snoozer.guard_effects_entitlement() returns trigger
language plpgsql security definer set search_path = '' as $$
declare tier text;
begin
  if tg_table_name = 'profiles' and tg_op = 'UPDATE'
    and new.appearance is not distinct from old.appearance then return new; end if;
  if new.appearance ? 'effects' then
    select (e.plan).plan into tier from snoozer.effective_plan(new.owner_id) e;
    if not snoozer.effects_permitted(new.appearance->'effects',coalesce(tier,'free')) then
      raise exception 'Profile effects exceed your current plan' using errcode='P1010';
    end if;
  end if;
  return new;
end $$;
create trigger guard_draft_effects before insert or update of appearance on snoozer.profiles
for each row execute function snoozer.guard_effects_entitlement();
create trigger guard_published_effects before insert or update of appearance on snoozer.published_profiles
for each row execute function snoozer.guard_effects_entitlement();

-- Public renderer can query only the effective tier of an actually published profile.
-- This protects against stale effects staying visible after expiry/revocation.
create function public.published_effect_tier(p_name text) returns text
language sql stable security definer set search_path = '' as $$
 select coalesce((e.plan).plan,'free')
 from snoozer.profiles p cross join lateral snoozer.effective_plan(p.owner_id) e
 where p.username=p_name and p.published_revision is not null
$$;
revoke all on function public.published_effect_tier(text) from public,anon,authenticated,service_role;
grant execute on function public.published_effect_tier(text) to anon,authenticated;
revoke all on function snoozer.valid_profile_effects(jsonb),snoozer.effects_permitted(jsonb,text),snoozer.guard_effects_entitlement() from public,anon,authenticated,service_role;

commit;
))
   and (not p_value ? 'effects' or snoozer.valid_profile_effects(p_value->'effects')),false)
 else false end
$;

create function snoozer.effects_permitted(e jsonb, p_tier text) returns boolean
language sql immutable set search_path = '' as $$
 select case when e is null or e->>'enabled'='false' then true
 when e->>'background'='gradient' and e->>'border'='none' and e->>'text'='none' and e->>'interaction'='none' then true
 when p_tier not in ('plus','pro','studio') then false
 when e->>'interaction'<>'none' and p_tier='plus' then false
 when e->>'preset'='studio-nebula' and p_tier<>'studio' then false
 else (
    (case when e->>'background'<>'none' then 1 else 0 end)
   +(case when e->>'border'<>'none' then 1 else 0 end)
   +(case when e->>'text'<>'none' then 1 else 0 end)
   +(case when e->>'interaction'<>'none' then 1 else 0 end)
 ) <= case p_tier when 'plus' then 2 else 4 end
 end
$$;

create function snoozer.guard_effects_entitlement() returns trigger
language plpgsql security definer set search_path = '' as $$
declare tier text;
begin
  if tg_table_name = 'profiles' and tg_op = 'UPDATE'
    and new.appearance is not distinct from old.appearance then return new; end if;
  if new.appearance ? 'effects' then
    select (e.plan).plan into tier from snoozer.effective_plan(new.owner_id) e;
    if not snoozer.effects_permitted(new.appearance->'effects',coalesce(tier,'free')) then
      raise exception 'Profile effects exceed your current plan' using errcode='P1010';
    end if;
  end if;
  return new;
end $$;
create trigger guard_draft_effects before insert or update of appearance on snoozer.profiles
for each row execute function snoozer.guard_effects_entitlement();
create trigger guard_published_effects before insert or update of appearance on snoozer.published_profiles
for each row execute function snoozer.guard_effects_entitlement();

-- Public renderer can query only the effective tier of an actually published profile.
-- This protects against stale effects staying visible after expiry/revocation.
create function public.published_effect_tier(p_name text) returns text
language sql stable security definer set search_path = '' as $$
 select coalesce((e.plan).plan,'free')
 from snoozer.profiles p cross join lateral snoozer.effective_plan(p.owner_id) e
 where p.username=p_name and p.published_revision is not null
$$;
revoke all on function public.published_effect_tier(text) from public,anon,authenticated,service_role;
grant execute on function public.published_effect_tier(text) to anon,authenticated;
revoke all on function snoozer.valid_profile_effects(jsonb),snoozer.effects_permitted(jsonb,text),snoozer.guard_effects_entitlement() from public,anon,authenticated,service_role;

commit;
