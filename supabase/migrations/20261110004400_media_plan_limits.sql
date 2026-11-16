-- Only retained WebP objects count toward the plan. Staged originals are temporary
-- and already have independent bucket, rate and expiry limits.
create function snoozer.retained_media_bytes(p_scope uuid) returns bigint
language sql stable set search_path = '' as $$
  select coalesce(sum(case
    when o.metadata->>'size' ~ '^[0-9]{1,12}$' then (o.metadata->>'size')::bigint
    else b.file_size_limit
  end), 0)::bigint
  from storage.objects o join storage.buckets b on b.id = o.bucket_id
  where o.bucket_id in ('avatar-images', 'gallery-images')
    and o.name like p_scope::text || '/%'
$$;

create function snoozer.effective_plan(p_owner uuid)
returns table(plan snoozer.plan_versions, expires_at timestamptz)
language sql stable set search_path = '' as $$
  with selected as (
    select g.plan, g.plan_version, g.expires_at
    from snoozer.entitlement_grants g
    where g.owner_id = p_owner and g.revoked_at is null and not g.payment_held
      and g.starts_at <= now() and g.expires_at > now()
    order by case g.plan when 'studio' then 3 when 'pro' then 2 else 1 end desc,
      g.plan_version desc, g.expires_at desc, g.id
    limit 1
  )
  select p, selected.expires_at
  from (select 1) actor left join selected on true
  join snoozer.plan_versions p on p.plan = coalesce(selected.plan, 'free')
    and p.version = coalesce(selected.plan_version, (select max(version) from snoozer.plan_versions where plan = 'free'))
$$;

create or replace function public.get_my_plan() returns jsonb
language sql stable security definer set search_path = '' as $$
  with actor as materialized (select snoozer.verified_user() as id)
  select jsonb_build_object(
    'plan', (e.plan).plan,
    'version', (e.plan).version,
    'quotas', jsonb_build_object(
      'profiles', (e.plan).profiles, 'links', (e.plan).links, 'mediaBytes', (e.plan).media_bytes,
      'domains', (e.plan).domains, 'aliases', (e.plan).aliases,
      'analyticsDays', (e.plan).analytics_days, 'teamSeats', (e.plan).team_seats
    ),
    'capabilities', jsonb_build_object(
      'premiumLayouts', (e.plan).premium_layouts, 'advancedEffects', (e.plan).advanced_effects,
      'scheduledPublishing', (e.plan).scheduled_publishing, 'abTesting', (e.plan).ab_testing,
      'removeBranding', (e.plan).remove_branding, 'advancedSeo', (e.plan).advanced_seo,
      'prioritySupport', (e.plan).priority_support, 'apiAccess', (e.plan).api_access
    ),
    'expiresAt', e.expires_at,
    'usage', jsonb_build_object(
      'publishedProfiles', (select count(*) from snoozer.profiles where owner_id = actor.id and published_revision is not null),
      'draftLinks', (select count(*) from snoozer.links where owner_id = actor.id),
      'mediaBytes', coalesce((select snoozer.retained_media_bytes(media_scope)
        from snoozer.profiles where owner_id = actor.id), 0)
    )
  ) from actor cross join lateral snoozer.effective_plan(actor.id) e
$$;

create or replace function snoozer.current_link_limit() returns integer
language sql stable set search_path = '' as $$
  select least(2000, coalesce((select (plan).links from snoozer.effective_plan(snoozer.verified_user())), 20))
$$;

create function snoozer.check_media_quota(p_owner uuid, p_expected integer, p_start boolean) returns void
language plpgsql set search_path = '' as $$
declare scope uuid;
declare used bigint;
declare allowance bigint;
begin
  select media_scope into scope from snoozer.profiles
    where owner_id = p_owner and revision = p_expected for update;
  if not found then return; end if;
  select (plan).media_bytes into allowance from snoozer.effective_plan(p_owner);
  used := snoozer.retained_media_bytes(scope);
  if allowance is null or used > allowance or (p_start and used = allowance) then
    raise exception 'Plan media storage limit reached' using errcode = 'P1104';
  end if;
end
$$;

-- The commit checks run after writing the derivative, so Storage's actual size,
-- including pending concurrent derivatives, is counted under the profile lock.
alter function public.prepare_avatar_upload(uuid,integer,boolean) set schema snoozer;
alter function public.prepare_gallery_upload(uuid,integer,text,uuid) set schema snoozer;
alter function public.commit_avatar_upload(uuid,integer,text,uuid) set schema snoozer;
alter function public.commit_gallery_upload(uuid,integer,uuid,uuid,integer,integer) set schema snoozer;

create function public.prepare_avatar_upload(p_owner uuid, p_expected integer, p_open boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_open then perform snoozer.check_media_quota(p_owner, p_expected, true); end if;
  return snoozer.prepare_avatar_upload(p_owner, p_expected, p_open);
end
$$;

create function public.prepare_gallery_upload(p_owner uuid, p_expected integer, p_alt text, p_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_id is null and p_alt is not null then
    perform snoozer.check_media_quota(p_owner, p_expected, true);
  end if;
  return snoozer.prepare_gallery_upload(p_owner, p_expected, p_alt, p_id);
end
$$;

create function public.commit_avatar_upload(p_owner uuid, p_expected integer, p_key text, p_avatar uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform snoozer.check_media_quota(p_owner, p_expected, false);
  return snoozer.commit_avatar_upload(p_owner, p_expected, p_key, p_avatar);
end
$$;

create function public.commit_gallery_upload(p_owner uuid, p_expected integer, p_id uuid, p_variant uuid,
  p_width integer, p_height integer) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform snoozer.check_media_quota(p_owner, p_expected, false);
  return snoozer.commit_gallery_upload(p_owner, p_expected, p_id, p_variant, p_width, p_height);
end
$$;

revoke execute on function snoozer.retained_media_bytes(uuid), snoozer.effective_plan(uuid),
  snoozer.check_media_quota(uuid,integer,boolean),
  snoozer.prepare_avatar_upload(uuid,integer,boolean), snoozer.prepare_gallery_upload(uuid,integer,text,uuid),
  snoozer.commit_avatar_upload(uuid,integer,text,uuid),
  snoozer.commit_gallery_upload(uuid,integer,uuid,uuid,integer,integer),
  public.prepare_avatar_upload(uuid,integer,boolean), public.prepare_gallery_upload(uuid,integer,text,uuid),
  public.commit_avatar_upload(uuid,integer,text,uuid),
  public.commit_gallery_upload(uuid,integer,uuid,uuid,integer,integer)
from public, anon, authenticated, service_role;

grant execute on function
  public.prepare_avatar_upload(uuid,integer,boolean), public.prepare_gallery_upload(uuid,integer,text,uuid),
  public.commit_avatar_upload(uuid,integer,text,uuid),
  public.commit_gallery_upload(uuid,integer,uuid,uuid,integer,integer)
to service_role;
