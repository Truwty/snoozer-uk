begin;

-- Extend the appearance allow-list only with bounded, non-executable values.
-- Template styles must match a first-party style token; arbitrary CSS/classes are never accepted.
-- Existing profile revisions remain valid and preserve their prior defaults.
create or replace function snoozer.valid_profile_appearance(p_value jsonb) returns boolean
language sql immutable set search_path = '' as $$
 select case when jsonb_typeof(p_value)='object' then coalesce(
   not exists (
     select 1
     from jsonb_object_keys(p_value) as allowed_appearance_key(key_name)
     where key_name <> all (array[
       'density','corners','layout','accent','entrance','backgroundImage','effects','colors','font','templateStyle',
       'gradientEnabled','opacity','blur','monochromeIcons','animatedTitle','usernameGlow','socialGlow','badgeGlow'
     ]::text[])
   )
   and p_value->'density' is not null and p_value->'corners' is not null
   and p_value->>'density' in ('compact','balanced','airy')
   and p_value->>'corners' in ('square','soft','round')
   and (p_value->'layout' is null or p_value->>'layout' in ('centred','editorial','portfolio'))
   and (p_value->'accent' is null or p_value->>'accent' in ('theme','mint','rose','ink'))
   and (p_value->'entrance' is null or p_value->>'entrance' in ('none','fade','rise'))
   and (p_value->'templateStyle' is null or (
     jsonb_typeof(p_value->'templateStyle')='string'
     and p_value->>'templateStyle' in (
       'slate','mono','paper','sakura','oni','cel','noir','dusk','grain',
       'terminal','matrix','synthwave','forest','ocean','desert','arcade',
       'esports','pixel','studio','brutalist','gallery','vinyl','waveform',
       'backstage','cloud','bloom','lilac','obsidian','goldline','velvet'
     )
   ))
   and (p_value->'backgroundImage' is null or
     (jsonb_typeof(p_value->'backgroundImage')='string' and lower(p_value->>'backgroundImage')
      ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
   and (p_value->'effects' is null or snoozer.valid_profile_effects(p_value->'effects'))
   and (p_value->'font' is null or p_value->>'font' in ('system','sans','serif','mono'))
   and (p_value->'gradientEnabled' is null or jsonb_typeof(p_value->'gradientEnabled')='boolean')
   and (p_value->'opacity' is null or (jsonb_typeof(p_value->'opacity')='number' and p_value->>'opacity' ~ '^(100|[4-9][0-9])$'))
   and (p_value->'blur' is null or (jsonb_typeof(p_value->'blur')='number' and p_value->>'blur' ~ '^(0|[1-9]|1[0-9]|2[0-4])$'))
   and (p_value->'monochromeIcons' is null or jsonb_typeof(p_value->'monochromeIcons')='boolean')
   and (p_value->'animatedTitle' is null or jsonb_typeof(p_value->'animatedTitle')='boolean')
   and (p_value->'usernameGlow' is null or jsonb_typeof(p_value->'usernameGlow')='boolean')
   and (p_value->'socialGlow' is null or jsonb_typeof(p_value->'socialGlow')='boolean')
   and (p_value->'badgeGlow' is null or jsonb_typeof(p_value->'badgeGlow')='boolean')
   and (p_value->'colors' is null or (
     jsonb_typeof(p_value->'colors')='object'
     and not exists (
       select 1
       from jsonb_object_keys(p_value->'colors') as allowed_colour_key(key_name)
       where key_name <> all (array[
         'background','text','accent','icon','effect','gradientStart','gradientEnd'
       ]::text[])
     )
     and ((p_value->'colors'->'background' is null) or (jsonb_typeof(p_value->'colors'->'background')='string' and p_value->'colors'->>'background' ~ '^#[0-9a-fA-F]{6}$'))
     and ((p_value->'colors'->'text' is null) or (jsonb_typeof(p_value->'colors'->'text')='string' and p_value->'colors'->>'text' ~ '^#[0-9a-fA-F]{6}$'))
     and ((p_value->'colors'->'accent' is null) or (jsonb_typeof(p_value->'colors'->'accent')='string' and p_value->'colors'->>'accent' ~ '^#[0-9a-fA-F]{6}$'))
     and ((p_value->'colors'->'icon' is null) or (jsonb_typeof(p_value->'colors'->'icon')='string' and p_value->'colors'->>'icon' ~ '^#[0-9a-fA-F]{6}$'))
     and ((p_value->'colors'->'effect' is null) or (jsonb_typeof(p_value->'colors'->'effect')='string' and p_value->'colors'->>'effect' ~ '^#[0-9a-fA-F]{6}$'))
     and ((p_value->'colors'->'gradientStart' is null) or (jsonb_typeof(p_value->'colors'->'gradientStart')='string' and p_value->'colors'->>'gradientStart' ~ '^#[0-9a-fA-F]{6}$'))
     and ((p_value->'colors'->'gradientEnd' is null) or (jsonb_typeof(p_value->'colors'->'gradientEnd')='string' and p_value->'colors'->>'gradientEnd' ~ '^#[0-9a-fA-F]{6}$'))
   )),false)
 else false end
$$;

notify pgrst, 'reload schema';
commit;
