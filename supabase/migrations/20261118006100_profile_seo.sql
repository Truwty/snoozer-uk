begin;
alter table snoozer.profiles add column seo_title text not null default '' check (char_length(seo_title)<=70), add column seo_description text not null default '' check (char_length(seo_description)<=160);
alter table snoozer.published_profiles add column seo_title text not null default '' check (char_length(seo_title)<=70), add column seo_description text not null default '' check (char_length(seo_description)<=160);
alter function public.save_profile(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb) set schema snoozer;
alter function snoozer.save_profile(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb) rename to save_profile_content;
revoke execute on function snoozer.save_profile_content(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb) from public,anon,authenticated,service_role;

create function public.save_profile(
 p_profile uuid, p_expected integer, p_name text, p_bio text, p_theme text, p_indexable boolean,
 p_links jsonb, p_publish boolean, p_remove_avatar boolean, p_sections jsonb default null,
 p_appearance jsonb default null, p_seo jsonb default null
) returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.verified_user();
declare current snoozer.profiles;
declare title text;
declare description text;
declare saved integer;
begin
 if p_seo is not null and (jsonb_typeof(p_seo) is distinct from 'object'
   or p_seo - array['title','description'] <> '{}'::jsonb
   or jsonb_typeof(p_seo->'title') is distinct from 'string'
   or jsonb_typeof(p_seo->'description') is distinct from 'string'
   or char_length(p_seo->>'title')>70 or char_length(p_seo->>'description')>160) then
  raise exception 'Invalid SEO metadata' using errcode='22023';
 end if;
 if p_publish then perform pg_advisory_xact_lock(hashtextextended('profile-publication:' || actor::text,0)); end if;
 select * into current from snoozer.profiles where id=p_profile and owner_id=actor for update;
 if not found or current.revision is distinct from p_expected then raise exception 'Profile revision conflict' using errcode='40001'; end if;
 title := case when p_seo is null then current.seo_title else btrim(p_seo->>'title') end;
 description := case when p_seo is null then current.seo_description else btrim(p_seo->>'description') end;
 if p_publish and (title<>'' or description<>'') and not coalesce((select (plan).advanced_seo from snoozer.effective_plan(actor)),false) then
  raise exception 'Custom SEO publication requires an eligible plan' using errcode='P1006';
 end if;
 saved := snoozer.save_profile_content(p_profile,p_expected,p_name,p_bio,p_theme,p_indexable,p_links,p_publish,p_remove_avatar,p_sections,p_appearance);
 update snoozer.profiles set seo_title=title,seo_description=description where id=p_profile;
 if p_publish then update snoozer.published_profiles set seo_title=title,seo_description=description where profile_id=p_profile and revision=saved; end if;
 return saved;
end $$;
revoke execute on function public.save_profile(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_profile(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb,jsonb) to authenticated;

alter function snoozer.profile_draft(uuid) rename to profile_draft_content;
create function snoozer.profile_draft(p_profile uuid) returns jsonb language sql stable set search_path='' as $$
 select snoozer.profile_draft_content(p.id) || jsonb_build_object('seo',jsonb_build_object('title',p.seo_title,'description',p.seo_description)) from snoozer.profiles p where p.id=p_profile
$$;
alter function snoozer.profile_snapshot(uuid,integer,boolean) rename to profile_snapshot_content;
create function snoozer.profile_snapshot(p_profile uuid,p_revision integer,p_public boolean) returns jsonb language sql stable set search_path='' as $$
 select snoozer.profile_snapshot_content(p_profile,p_revision,p_public) || jsonb_build_object('seo',jsonb_build_object('title',v.seo_title,'description',v.seo_description))
 from snoozer.published_profiles v where v.profile_id=p_profile and v.revision=p_revision
$$;
revoke execute on function snoozer.profile_draft(uuid),snoozer.profile_snapshot(uuid,integer,boolean) from public,anon,authenticated,service_role;
create or replace function public.restore_publication(p_profile uuid, p_revision integer, p_expected integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform snoozer.restore_profile_sections_for_id(p_profile, p_revision, p_expected);
  update snoozer.gallery_items set position = null where profile_id = p_profile and position is not null;
  with visible_items as (
    select g.id, row_number() over (order by s.position) as position
    from snoozer.published_gallery s join snoozer.gallery_items g on g.profile_id = s.profile_id and g.id = s.item
    where s.profile_id = p_profile and s.revision = p_revision and g.blocked_at is null
  )
  update snoozer.gallery_items g set position = v.position
    from visible_items v where g.profile_id = p_profile and g.id = v.id;
  update snoozer.profiles p set appearance = v.appearance, seo_title=v.seo_title, seo_description=v.seo_description
    from snoozer.published_profiles v
    where p.id = p_profile and v.profile_id = p_profile and v.revision = p_revision;
end $$;


commit;
