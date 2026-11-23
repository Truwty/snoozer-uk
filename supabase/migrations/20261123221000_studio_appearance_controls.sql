begin;

-- Extend the appearance allow-list only with bounded, non-executable values.
-- Existing profile revisions remain valid and preserve their prior defaults.
create or replace function snoozer.valid_profile_appearance(p_value jsonb) returns boolean
language sql immutable set search_path = '' as $$
 select case when jsonb_typeof(p_value)='object' then coalesce(
   p_value - array[
     'layout','accent','entrance','backgroundImage','effects','colors','font',
     'gradientEnabled','opacity','blur','monochromeIcons','animatedTitle',
     'usernameGlow','socialGlow','badgeGlow'
   ] = jsonb_build_object('density',p_value->'density','corners',p_value->'corners')
   and p_value->>'density' in ('compact','balanced','airy')
   and p_value->>'corners' in ('square','soft','round')
   and (not p_value ? 'layout' or p_value->>'layout' in ('centred','editorial','portfolio'))
   and (not p_value ? 'accent' or p_value->>'accent' in ('theme','mint','rose','ink'))
   and (not p_value ? 'entrance' or p_value->>'entrance' in ('none','fade','rise'))
   and (not p_value ? 'backgroundImage' or
     (jsonb_typeof(p_value->'backgroundImage')='string' and lower(p_value->>'backgroundImage')
      ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
   and (not p_value ? 'effects' or snoozer.valid_profile_effects(p_value->'effects'))
   and (not p_value ? 'font' or p_value->>'font' in ('system','sans','serif','mono'))
   and (not p_value ? 'gradientEnabled' or jsonb_typeof(p_value->'gradientEnabled')='boolean')
   and (not p_value ? 'opacity' or (jsonb_typeof(p_value->'opacity')='number' and p_value->>'opacity' ~ '^(100|[4-9][0-9])$'))
   and (not p_value ? 'blur' or (jsonb_typeof(p_value->'blur')='number' and p_value->>'blur' ~ '^(0|[1-9]|1[0-9]|2[0-4])$'))
   and (not p_value ? 'monochromeIcons' or jsonb_typeof(p_value->'monochromeIcons')='boolean')
   and (not p_value ? 'animatedTitle' or jsonb_typeof(p_value->'animatedTitle')='boolean')
   and (not p_value ? 'usernameGlow' or jsonb_typeof(p_value->'usernameGlow')='boolean')
   and (not p_value ? 'socialGlow' or jsonb_typeof(p_value->'socialGlow')='boolean')
   and (not p_value ? 'badgeGlow' or jsonb_typeof(p_value->'badgeGlow')='boolean')
   and (not p_value ? 'colors' or (
     jsonb_typeof(p_value->'colors')='object'
     and p_value->'colors' - array['background','text','accent','icon','effect','gradientStart','gradientEnd']='{}'::jsonb
     and (not (p_value->'colors') ? 'background' or (jsonb_typeof(p_value->'colors'->'background')='string' and p_value->'colors'->>'background' ~ '^#[0-9a-fA-F]{6}$'))
     and (not (p_value->'colors') ? 'text' or (jsonb_typeof(p_value->'colors'->'text')='string' and p_value->'colors'->>'text' ~ '^#[0-9a-fA-F]{6}$'))
     and (not (p_value->'colors') ? 'accent' or (jsonb_typeof(p_value->'colors'->'accent')='string' and p_value->'colors'->>'accent' ~ '^#[0-9a-fA-F]{6}$'))
     and (not (p_value->'colors') ? 'icon' or (jsonb_typeof(p_value->'colors'->'icon')='string' and p_value->'colors'->>'icon' ~ '^#[0-9a-fA-F]{6}$'))
     and (not (p_value->'colors') ? 'effect' or (jsonb_typeof(p_value->'colors'->'effect')='string' and p_value->'colors'->>'effect' ~ '^#[0-9a-fA-F]{6}$'))
     and (not (p_value->'colors') ? 'gradientStart' or (jsonb_typeof(p_value->'colors'->'gradientStart')='string' and p_value->'colors'->>'gradientStart' ~ '^#[0-9a-fA-F]{6}$'))
     and (not (p_value->'colors') ? 'gradientEnd' or (jsonb_typeof(p_value->'colors'->'gradientEnd')='string' and p_value->'colors'->>'gradientEnd' ~ '^#[0-9a-fA-F]{6}$'))
   )),false)
 else false end
$$;

notify pgrst, 'reload schema';
commit;
