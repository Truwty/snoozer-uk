begin;

-- Add only named, bounded effects; arbitrary CSS and user-provided code remain rejected.
create or replace function snoozer.valid_profile_effects(e jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(e) = 'object' then coalesce(
    e - array['version','enabled','background','border','particles','links','text','interaction','intensity','speed','preset'] = '{}'::jsonb
    and e ?& array['version','enabled','background','border','particles','links','text','interaction','intensity','speed','preset']
    and jsonb_typeof(e->'version') = 'number' and e->>'version' = '1'
    and jsonb_typeof(e->'enabled') = 'boolean'
    and e->>'background' in ('none','gradient','aurora','stars','snow','rain','mesh')
    and e->>'border' in ('none','glow','neon','gradient')
    and e->>'particles' in ('none','dust','fireflies','sparkles')
    and e->>'links' in ('none','lift','shine','glow')
    and e->>'text' in ('none','typewriter','shimmer','glitch','rainbow','fuzzy','shuffle')
    and e->>'interaction' in ('none','tilt','spotlight','trail')
    and e->>'speed' in ('slow','normal','fast')
    and e->>'preset' in ('none','lagoon-dream','night-sky','frost','cyber','studio-nebula')
    and jsonb_typeof(e->'intensity') = 'number'
    and (e->>'intensity') ~ '^(0|[1-9][0-9]?|100)$', false)
  else false end
$$;

notify pgrst, 'reload schema';
commit;
