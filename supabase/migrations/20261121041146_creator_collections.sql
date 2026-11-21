begin;

-- Separate editorial grouping only. Product drafts, frozen PDFs, Checkout,
-- reviews and purchased versions are unaffected by collection edits.
create table snoozer.creator_collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references snoozer.profiles(id) on delete cascade,
  revision integer not null default 0 check(revision>=0),
  title text not null check(char_length(title) between 1 and 80 and title=btrim(title) and title !~ '[[:cntrl:]]'),
  description text not null default '' check(char_length(description)<=500 and replace(replace(description,E'\n',''),E'\t','') !~ '[[:cntrl:]]'),
  visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index creator_collections_profile on snoozer.creator_collections(profile_id,created_at,id);
create table snoozer.creator_collection_products (
  collection_id uuid not null references snoozer.creator_collections(id) on delete cascade,
  product_id uuid not null references snoozer.product_drafts(id) on delete cascade,
  position integer not null check(position between 1 and 5),
  primary key(collection_id,product_id),
  unique(collection_id,position)
);
create index creator_collection_products_product on snoozer.creator_collection_products(product_id);
alter table snoozer.creator_collections enable row level security;
alter table snoozer.creator_collection_products enable row level security;
revoke all on snoozer.creator_collections,snoozer.creator_collection_products from public,anon,authenticated,service_role;

create function public.list_my_creator_collections(p_profile uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
  if p_profile is null or not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor)
  then raise exception 'Profile unavailable' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',c.id,'revision',c.revision,'title',c.title,'description',c.description,'visible',c.visible,
    'productIds',coalesce((select jsonb_agg(cp.product_id order by cp.position) from snoozer.creator_collection_products cp where cp.collection_id=c.id),'[]'::jsonb)
  ) order by c.created_at,c.id)
    from snoozer.creator_collections c where c.profile_id=p_profile and c.owner_id=actor),'[]'::jsonb);
end $$;

create function public.save_my_creator_collection(
  p_profile uuid,p_id uuid,p_expected integer,p_title text,p_description text,p_visible boolean,
  p_products uuid[],p_delete boolean default false
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user(); old snoozer.creator_collections; target uuid;
begin
  -- Serialise per-user quotas, product edits and cross-profile operations.
  perform 1 from auth.users where id=actor for update;
  if p_profile is null or not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor)
  then raise exception 'Profile unavailable' using errcode='42501'; end if;
  if p_expected is null or p_expected<0 or p_expected>2147483646 or p_delete is null
  then raise exception 'Invalid collection request' using errcode='22023'; end if;

  if p_id is not null then
    select * into old from snoozer.creator_collections
      where id=p_id and profile_id=p_profile and owner_id=actor for update;
    if not found then raise exception 'Collection unavailable' using errcode='42501'; end if;
    if old.revision<>p_expected then raise exception 'Collection changed' using errcode='40001'; end if;
  elsif p_expected<>0 or p_delete then
    raise exception 'Invalid collection request' using errcode='22023';
  end if;

  if p_delete then
    delete from snoozer.creator_collections where id=p_id and owner_id=actor;
    return p_id;
  end if;

  if p_title is null or char_length(btrim(p_title)) not between 1 and 80 or p_title ~ '[[:cntrl:]]'
    or p_description is null or char_length(p_description)>500
    or replace(replace(p_description,E'\n',''),E'\t','') ~ '[[:cntrl:]]'
    or p_visible is null or p_products is null or cardinality(p_products)>5
    or exists(select 1 from unnest(p_products) v where v is null)
    or (select count(distinct v) from unnest(p_products) v)<>cardinality(p_products)
  then raise exception 'Invalid collection fields' using errcode='22023'; end if;

  -- All product IDs must belong to this profile and seller, including archived drafts.
  if (select count(*) from snoozer.product_drafts d
      where d.id=any(p_products) and d.profile_id=p_profile and d.owner_id=actor)<>cardinality(p_products)
  then raise exception 'Product unavailable for collection' using errcode='42501'; end if;

  if p_id is null then
    if (select count(*) from snoozer.creator_collections where profile_id=p_profile and owner_id=actor)>=5
    then raise exception 'Collection limit reached' using errcode='P1201'; end if;
    insert into snoozer.creator_collections(owner_id,profile_id,title,description,visible)
      values(actor,p_profile,btrim(p_title),p_description,p_visible) returning id into target;
  else
    update snoozer.creator_collections set title=btrim(p_title),description=p_description,
      visible=p_visible,revision=revision+1,updated_at=now()
      where id=p_id returning id into target;
    delete from snoozer.creator_collection_products where collection_id=target;
  end if;

  insert into snoozer.creator_collection_products(collection_id,product_id,position)
    select target, v, n::integer from unnest(p_products) with ordinality as members(v,n);
  return target;
end $$;

-- Public collection projection is an editorial view of ONLY product versions
-- already admitted through the original reviewed, short-lived sandbox store RPC.
-- A collection never makes a private, expired, unready or unapproved product visible.
create function public.get_creator_sandbox_collections(p_name text) returns jsonb
language sql stable security definer set search_path='' as $$
 with store as (select public.get_creator_sandbox_store(p_name) as payload),
 eligible as (
   select o.product_id,(entry.value->>'versionId')::uuid as version_id
   from store s cross join lateral jsonb_array_elements(coalesce(s.payload->'items','[]'::jsonb)) entry
   join snoozer.creator_sandbox_offers o on o.version_id=(entry.value->>'versionId')::uuid
 ),
 grouped as (
   select c.id,c.title,c.description,c.created_at,
     jsonb_agg(e.version_id order by cp.position) as version_ids
   from snoozer.creator_collections c
   join snoozer.profiles p on p.id=c.profile_id and p.owner_id=c.owner_id and p.username::text=p_name
   join snoozer.creator_collection_products cp on cp.collection_id=c.id
   join eligible e on e.product_id=cp.product_id
   where c.visible
   group by c.id,c.title,c.description,c.created_at
 )
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',g.id,'title',g.title,'description',g.description,'versionIds',g.version_ids
 ) order by g.created_at,g.id),'[]'::jsonb) from grouped g
$$;

revoke execute on function public.list_my_creator_collections(uuid),
  public.save_my_creator_collection(uuid,uuid,integer,text,text,boolean,uuid[],boolean),
  public.get_creator_sandbox_collections(text) from public,anon,authenticated,service_role;
grant execute on function public.list_my_creator_collections(uuid),
  public.save_my_creator_collection(uuid,uuid,integer,text,text,boolean,uuid[],boolean) to authenticated;
grant execute on function public.get_creator_sandbox_collections(text) to anon,authenticated;

commit;
