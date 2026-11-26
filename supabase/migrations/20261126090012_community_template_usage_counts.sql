alter table snoozer.community_templates
  add column usage_count integer not null default 0 check (usage_count >= 0);

create function snoozer.count_community_template_use()
returns trigger language plpgsql security definer set search_path = '' as $$
declare template_id uuid;
begin
  if new.last_used_at is null or (tg_op = 'UPDATE' and old.last_used_at is not distinct from new.last_used_at) then
    return new;
  end if;
  begin
    template_id := new.template_key::uuid;
  exception when invalid_text_representation then
    return new;
  end;
  update snoozer.community_templates
    set usage_count = usage_count + 1
    where id = template_id and status = 'approved';
  return new;
end;
$$;

create trigger community_template_usage_count
after insert or update of last_used_at on snoozer.template_activity
for each row execute function snoozer.count_community_template_use();
revoke all on function snoozer.count_community_template_use() from public,anon,authenticated,service_role;

create or replace function public.get_my_template_activity() returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare actor uuid:=snoozer.verified_user();
begin return jsonb_build_object(
 'favorites',coalesce((select jsonb_agg(template_key order by favorited_at desc) from snoozer.template_activity where owner_id=actor and favorited_at is not null),'[]'::jsonb),
 'recent',coalesce((select jsonb_agg(template_key order by last_used_at desc) from (select template_key,last_used_at from snoozer.template_activity where owner_id=actor and last_used_at is not null order by last_used_at desc limit 50) recent_items),'[]'::jsonb),
 'uploads',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description,'status',status,'created_at',created_at) order by created_at desc) from snoozer.community_templates where owner_id=actor),'[]'::jsonb),
 'community',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description,'created_at',created_at,'usage_count',usage_count) order by usage_count desc,created_at desc) from (select id,title,description,created_at,usage_count from snoozer.community_templates where status='approved' order by usage_count desc,created_at desc limit 500) community_items),'[]'::jsonb)); end $$;
