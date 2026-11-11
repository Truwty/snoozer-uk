-- The renderer maps the entrance choice to a built-in motion preset.
create or replace function snoozer.valid_profile_appearance(p_value jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p_value) = 'object' then coalesce(
    p_value - array['layout','accent','entrance'] = jsonb_build_object('density', p_value->'density', 'corners', p_value->'corners')
    and p_value->>'density' in ('compact','balanced','airy')
    and p_value->>'corners' in ('square','soft','round')
    and (not p_value ? 'layout' or p_value->>'layout' in ('centred','editorial'))
    and (not p_value ? 'accent' or p_value->>'accent' in ('theme','mint','rose','ink'))
    and (not p_value ? 'entrance' or p_value->>'entrance' in ('none','fade')), false) else false end
$$;
