create or replace function public.get_my_template_activity() returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare actor uuid:=snoozer.verified_user();
begin return jsonb_build_object(
 'favorites',coalesce((select jsonb_agg(template_key order by favorited_at desc) from snoozer.template_activity where owner_id=actor and favorited_at is not null),'[]'::jsonb),
 'recent',coalesce((select jsonb_agg(template_key order by last_used_at desc) from (select template_key,last_used_at from snoozer.template_activity where owner_id=actor and last_used_at is not null order by last_used_at desc limit 50) recent_items),'[]'::jsonb),
 'uploads',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description,'status',status,'created_at',created_at) order by created_at desc) from snoozer.community_templates where owner_id=actor),'[]'::jsonb),
 'community',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'description',c.description,'created_at',c.created_at,'usage_count',c.usage_count) order by c.usage_count desc,c.created_at desc)
   from snoozer.community_templates c join snoozer.template_activity a on a.template_key=c.id::text and a.owner_id=actor
   where c.status='approved' and (a.favorited_at is not null or a.last_used_at is not null)),'[]'::jsonb)); end $$;

create function public.list_community_templates(p_query text default '',p_sort text default 'newest',p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare actor uuid:=snoozer.verified_user(); needle text:=lower(btrim(coalesce(p_query,''))); total integer; page_count integer; actual_page integer; items jsonb;
begin
  if p_query is null or char_length(p_query)>80 or p_sort is null or p_sort not in ('newest','popular') or p_page is null or p_page not between 1 and 100000 then
    raise exception 'Invalid community template filters' using errcode='22023';
  end if;
  select count(*)::integer into total from snoozer.community_templates c
    where c.status='approved' and (needle='' or position(needle in lower(c.title||' '||c.description))>0);
  page_count:=greatest(1,ceil(total::numeric/12)::integer);
  actual_page:=least(p_page,page_count);
  if p_sort='popular' then
    select coalesce(jsonb_agg(row_to_json(t)::jsonb),'[]'::jsonb) into items from (
      select id,title,description,created_at,usage_count from snoozer.community_templates c
      where c.status='approved' and (needle='' or position(needle in lower(c.title||' '||c.description))>0)
      order by usage_count desc,created_at desc,id limit 12 offset (actual_page-1)*12
    ) t;
  else
    select coalesce(jsonb_agg(row_to_json(t)::jsonb),'[]'::jsonb) into items from (
      select id,title,description,created_at,usage_count from snoozer.community_templates c
      where c.status='approved' and (needle='' or position(needle in lower(c.title||' '||c.description))>0)
      order by created_at desc,id limit 12 offset (actual_page-1)*12
    ) t;
  end if;
  return jsonb_build_object('items',items,'total',total,'page',actual_page,'pageCount',page_count);
end;
$$;

revoke all on function public.list_community_templates(text,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.list_community_templates(text,text,integer) to authenticated;
