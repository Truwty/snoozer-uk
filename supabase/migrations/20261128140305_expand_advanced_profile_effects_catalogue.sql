-- Extend the allowlisted visual effect catalogue and keep database enforcement
-- aligned with src/lib/profile-effects.ts.
create or replace function snoozer.valid_profile_effects(e jsonb)
returns boolean
language sql
immutable
set search_path to ''
as $function$
  select case when jsonb_typeof(e) = 'object' then coalesce(
    e - array['version','enabled','background','border','particles','links','text','interaction','intensity','speed','preset'] = '{}'::jsonb
    and e ?& array['version','enabled','background','border','particles','links','text','interaction','intensity','speed','preset']
    and jsonb_typeof(e->'version') = 'number' and e->>'version' = '1'
    and jsonb_typeof(e->'enabled') = 'boolean'
    and e->>'background' in (
      'none','gradient','aurora','stars','snow','rain','mesh','nebula','galaxy','sunset','ocean',
      'vaporwave','liquid-metal','circuit','matrix','hologram','prism','aurora-borealis','eclipse',
      'retro-grid','supernova','singularity','quantum','sakura-night'
    )
    and e->>'border' in (
      'none','glow','neon','gradient','pulse','iridescent','chrome','glass','aura','scanline',
      'dashed','corner-lights','double','plasma','pixel','hologram','orbit','prism'
    )
    and e->>'particles' in (
      'none','dust','fireflies','sparkles','embers','bubbles','petals','snowflakes','meteors','confetti',
      'stars','hearts','electric','shards','data-stream','sakura','plasma','smoke','orbs','butterflies',
      'comets','matrix-rain'
    )
    and e->>'links' in (
      'none','lift','shine','glow','magnetic','bounce','underline','sweep','pulse','border-glow','ripple',
      'tilt','scale','gradient','glass','glitch','3d-tilt'
    )
    and e->>'text' in (
      'none','typewriter','shimmer','glitch','rainbow','fuzzy','shuffle','neon','chromatic','wave','pulse',
      'scanline','outline','gradient','flicker','blur-in','letter-spacing','aura','scramble','terminal'
    )
    and e->>'interaction' in (
      'none','tilt','spotlight','trail','magnetic','parallax','cursor-glow','ripple','orbit'
    )
    and e->>'speed' in ('slow','normal','fast')
    and e->>'preset' in (
      'none','lagoon-dream','night-sky','frost','cyber','studio-nebula','sunset-drive','ocean-depths',
      'crystal-glass','neon-overdrive','sakura-bloom','deep-space','terminal-core','solar-flare'
    )
    and jsonb_typeof(e->'intensity') = 'number'
    and (e->>'intensity') ~ '^(0|[1-9][0-9]?|100)$',
    false
  ) else false end
$function$;

-- Internal tier map: Free=0, Plus=1, Pro=2, Studio=3. Unknown values fail closed.
create or replace function snoozer.effect_required_tier(p_group text, p_value text)
returns integer
language sql
immutable
set search_path to ''
as $function$
  select case p_group
    when 'background' then case p_value
      when 'none' then 0 when 'gradient' then 0
      when 'aurora' then 1 when 'stars' then 1 when 'snow' then 1 when 'rain' then 1
      when 'mesh' then 1 when 'sunset' then 1 when 'ocean' then 1
      when 'nebula' then 2 when 'galaxy' then 2 when 'vaporwave' then 2 when 'liquid-metal' then 2
      when 'circuit' then 2 when 'matrix' then 2 when 'hologram' then 2 when 'prism' then 2
      when 'aurora-borealis' then 2 when 'eclipse' then 2 when 'retro-grid' then 2 when 'sakura-night' then 2
      when 'supernova' then 3 when 'singularity' then 3 when 'quantum' then 3
      else 99 end
    when 'border' then case p_value
      when 'none' then 0
      when 'glow' then 1 when 'neon' then 1 when 'gradient' then 1 when 'pulse' then 1
      when 'iridescent' then 1 when 'glass' then 1 when 'aura' then 1
      when 'chrome' then 2 when 'scanline' then 2 when 'dashed' then 2 when 'corner-lights' then 2
      when 'double' then 2 when 'pixel' then 2 when 'prism' then 2
      when 'plasma' then 3 when 'hologram' then 3 when 'orbit' then 3
      else 99 end
    when 'particles' then case p_value
      when 'none' then 0
      when 'dust' then 1 when 'fireflies' then 1 when 'sparkles' then 1 when 'embers' then 1
      when 'bubbles' then 1 when 'petals' then 1 when 'snowflakes' then 1 when 'stars' then 1
      when 'meteors' then 2 when 'confetti' then 2 when 'hearts' then 2 when 'electric' then 2
      when 'shards' then 2 when 'sakura' then 2 when 'smoke' then 2 when 'orbs' then 2
      when 'butterflies' then 2 when 'comets' then 2
      when 'data-stream' then 3 when 'plasma' then 3 when 'matrix-rain' then 3
      else 99 end
    when 'links' then case p_value
      when 'none' then 0
      when 'lift' then 1 when 'shine' then 1 when 'glow' then 1 when 'bounce' then 1
      when 'underline' then 1 when 'sweep' then 1 when 'pulse' then 1
      when 'border-glow' then 2 when 'ripple' then 2 when 'tilt' then 2 when 'scale' then 2
      when 'gradient' then 2 when 'glass' then 2
      when 'magnetic' then 3 when 'glitch' then 3 when '3d-tilt' then 3
      else 99 end
    when 'text' then case p_value
      when 'none' then 0
      when 'typewriter' then 1 when 'shimmer' then 1 when 'rainbow' then 1 when 'fuzzy' then 1
      when 'shuffle' then 1 when 'neon' then 1 when 'wave' then 1 when 'pulse' then 1
      when 'outline' then 1 when 'gradient' then 1 when 'blur-in' then 1
      when 'glitch' then 2 when 'chromatic' then 2 when 'scanline' then 2 when 'flicker' then 2
      when 'letter-spacing' then 2 when 'aura' then 2
      when 'scramble' then 3 when 'terminal' then 3
      else 99 end
    when 'interaction' then case p_value
      when 'none' then 0
      when 'tilt' then 2 when 'spotlight' then 2 when 'trail' then 2 when 'ripple' then 2
      when 'magnetic' then 3 when 'parallax' then 3 when 'cursor-glow' then 3 when 'orbit' then 3
      else 99 end
    when 'preset' then case p_value
      when 'none' then 0
      when 'lagoon-dream' then 1 when 'night-sky' then 1 when 'frost' then 1
      when 'sunset-drive' then 1 when 'ocean-depths' then 1
      when 'cyber' then 2 when 'crystal-glass' then 2 when 'neon-overdrive' then 2 when 'sakura-bloom' then 2
      when 'studio-nebula' then 3 when 'deep-space' then 3 when 'terminal-core' then 3 when 'solar-flare' then 3
      else 99 end
    else 99
  end
$function$;

revoke all on function snoozer.effect_required_tier(text,text) from public, anon, authenticated, service_role;

create or replace function snoozer.effects_permitted(e jsonb, p_tier text)
returns boolean
language sql
immutable
set search_path to ''
as $function$
  select case
    when e is null or e->>'enabled'='false' then true
    when p_tier not in ('free','plus','pro','studio') then false
    when snoozer.effect_required_tier('preset',e->>'preset') >
      case p_tier when 'free' then 0 when 'plus' then 1 when 'pro' then 2 else 3 end then false
    when snoozer.effect_required_tier('background',e->>'background') >
      case p_tier when 'free' then 0 when 'plus' then 1 when 'pro' then 2 else 3 end then false
    when snoozer.effect_required_tier('border',e->>'border') >
      case p_tier when 'free' then 0 when 'plus' then 1 when 'pro' then 2 else 3 end then false
    when snoozer.effect_required_tier('particles',e->>'particles') >
      case p_tier when 'free' then 0 when 'plus' then 1 when 'pro' then 2 else 3 end then false
    when snoozer.effect_required_tier('links',e->>'links') >
      case p_tier when 'free' then 0 when 'plus' then 1 when 'pro' then 2 else 3 end then false
    when snoozer.effect_required_tier('text',e->>'text') >
      case p_tier when 'free' then 0 when 'plus' then 1 when 'pro' then 2 else 3 end then false
    when snoozer.effect_required_tier('interaction',e->>'interaction') >
      case p_tier when 'free' then 0 when 'plus' then 1 when 'pro' then 2 else 3 end then false
    when p_tier='free' then
      e->>'background'='gradient'
      and e->>'border'='none' and e->>'particles'='none' and e->>'links'='none'
      and e->>'text'='none' and e->>'interaction'='none' and e->>'preset'='none'
    else (
      (case when e->>'background'<>'none' then 1 else 0 end)
      +(case when e->>'border'<>'none' then 1 else 0 end)
      +(case when e->>'particles'<>'none' then 1 else 0 end)
      +(case when e->>'links'<>'none' then 1 else 0 end)
      +(case when e->>'text'<>'none' then 1 else 0 end)
      +(case when e->>'interaction'<>'none' then 1 else 0 end)
    ) <= case p_tier when 'plus' then 2 when 'pro' then 4 else 6 end
  end
$function$;

-- The entitlement flag is authoritative. Even a valid paid-plan name is
-- treated as Free where the selected version does not include advanced effects.
create or replace function snoozer.guard_effects_entitlement()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare tier text;
begin
  if tg_table_name='profiles' and tg_op='UPDATE'
    and new.appearance is not distinct from old.appearance then
    return new;
  end if;
  if new.appearance ? 'effects' then
    select case when coalesce((e.plan).advanced_effects,false)
      then coalesce((e.plan).plan,'free') else 'free' end
    into tier
    from snoozer.effective_plan(new.owner_id) e;
    if not snoozer.effects_permitted(new.appearance->'effects',coalesce(tier,'free')) then
      raise exception 'Effects exceed plan' using errcode='P1010';
    end if;
  end if;
  return new;
end
$function$;

create or replace function public.published_effect_tier(p_name text)
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select case when coalesce((e.plan).advanced_effects,false)
    then coalesce((e.plan).plan,'free') else 'free' end
  from snoozer.profiles p
  cross join lateral snoozer.effective_plan(p.owner_id) e
  where p.username=p_name and p.published_revision is not null
$function$;
