begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('product-files','product-files',false,4194304,array['application/pdf']);
create table snoozer.product_files (
 product_id uuid primary key references snoozer.product_drafts(id) on delete cascade,
 id uuid not null unique default gen_random_uuid(),
 media_scope uuid not null references snoozer.profiles(media_scope) on delete cascade,
 bytes integer not null check(bytes between 1 and 4194304),
 state text not null default 'pending' check(state in ('pending','ready','removing')),
 created_at timestamptz not null default now()
);
alter table snoozer.product_files enable row level security;
revoke all on snoozer.product_files from public,anon,authenticated,service_role;

create or replace function snoozer.retained_media_bytes(p_scope uuid) returns bigint language sql stable set search_path='' as $$
 select coalesce((select sum(case when o.metadata->>'size' ~ '^[0-9]{1,12}$' then (o.metadata->>'size')::bigint else b.file_size_limit end)
  from storage.objects o join storage.buckets b on b.id=o.bucket_id where o.bucket_id in ('avatar-images','gallery-images','product-files') and o.name like p_scope::text||'/%'),0)::bigint
  +coalesce((select sum(greatest(0,f.bytes-coalesce((select case when o.metadata->>'size' ~ '^[0-9]{1,12}$' then (o.metadata->>'size')::bigint else 4194304 end
   from storage.objects o where o.bucket_id='product-files' and o.name=f.media_scope::text||'/'||f.id::text||'.pdf' limit 1),0)))
   from snoozer.product_files f where f.media_scope=p_scope),0)::bigint
$$;

create function public.list_my_product_files(p_profile uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor) then raise exception 'Profile unavailable' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('productId',d.id,'id',f.id,'scope',f.media_scope,'bytes',f.bytes,'state',f.state) order by d.id)
  from snoozer.product_drafts d join snoozer.product_files f on f.product_id=d.id where d.profile_id=p_profile and d.owner_id=actor),'[]'::jsonb);
end $$;

create function public.get_my_product_file(p_file uuid) returns jsonb language sql stable security definer set search_path='' as $$
 with actor as materialized(select snoozer.verified_user() as id)
 select jsonb_build_object('productId',d.id,'id',f.id,'scope',f.media_scope,'bytes',f.bytes,'state',f.state)
 from actor join snoozer.product_drafts d on d.owner_id=actor.id join snoozer.product_files f on f.product_id=d.id
 join snoozer.profiles p on p.id=d.profile_id and p.owner_id=actor.id and p.media_scope=f.media_scope
 where f.id=p_file and f.state='ready'
$$;

create function public.prepare_product_file(p_owner uuid,p_product uuid,p_bytes integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare scope uuid; file snoozer.product_files; allowance bigint; used bigint;
begin
 if p_bytes is null or p_bytes not between 1 and 4194304 then raise exception 'Invalid file size' using errcode='22023'; end if;
 perform 1 from auth.users where id=p_owner and email_confirmed_at is not null for update;
 if not found then raise exception 'Verified owner required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('profile-media:'||p_owner::text,0));
 select p.media_scope into scope from snoozer.product_drafts d join snoozer.profiles p on p.id=d.profile_id
  where d.id=p_product and d.owner_id=p_owner and p.owner_id=p_owner for update of d,p;
 if not found then raise exception 'Product unavailable' using errcode='42501'; end if;
 if exists(select 1 from snoozer.product_files where product_id=p_product) then return null; end if;
 select (plan).media_bytes into allowance from snoozer.effective_plan(p_owner);
 select coalesce(sum(snoozer.retained_media_bytes(media_scope)),0) into used from snoozer.profiles where owner_id=p_owner;
 if allowance is null or used+p_bytes>allowance then raise exception 'Media allowance reached' using errcode='P1104'; end if;
 insert into snoozer.product_files(product_id,media_scope,bytes) values(p_product,scope,p_bytes) returning * into file;
 return jsonb_build_object('productId',file.product_id,'id',file.id,'scope',file.media_scope,'bytes',file.bytes,'state',file.state);
end $$;

create function public.commit_product_file(p_owner uuid,p_product uuid,p_file uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare file snoozer.product_files; used bigint; allowance bigint;
begin
 perform 1 from auth.users where id=p_owner and email_confirmed_at is not null for update;
 if not found then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended('profile-media:'||p_owner::text,0));
 select f.* into file from snoozer.product_files f join snoozer.product_drafts d on d.id=f.product_id join snoozer.profiles p on p.id=d.profile_id
  where f.product_id=p_product and f.id=p_file and d.owner_id=p_owner and p.owner_id=p_owner and f.media_scope=p.media_scope for update of f;
 if not found or file.state='removing' then return false; end if;
 if not exists(select 1 from storage.objects o where bucket_id='product-files' and name=file.media_scope::text||'/'||file.id::text||'.pdf'
  and metadata->>'size'=file.bytes::text and metadata->>'mimetype'='application/pdf') then return false; end if;
 select (plan).media_bytes into allowance from snoozer.effective_plan(p_owner);
 select coalesce(sum(snoozer.retained_media_bytes(media_scope)),0) into used from snoozer.profiles where owner_id=p_owner;
 if allowance is null or used>allowance then raise exception 'Media allowance reached' using errcode='P1104'; end if;
 update snoozer.product_files set state='ready' where product_id=p_product;
 return true;
end $$;

create function public.remove_my_product_file(p_product uuid,p_file uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user(); file snoozer.product_files;
begin
 perform 1 from auth.users where id=actor for update;
 perform pg_advisory_xact_lock(hashtextextended('profile-media:'||actor::text,0));
 update snoozer.product_files f set state='removing' from snoozer.product_drafts d where d.id=f.product_id and d.owner_id=actor
  and f.product_id=p_product and f.id=p_file returning f.* into file;
 if not found then raise exception 'File unavailable' using errcode='42501'; end if;
 return jsonb_build_object('productId',file.product_id,'id',file.id,'scope',file.media_scope,'bytes',file.bytes,'state',file.state);
end $$;

create function public.complete_product_file_removal(p_owner uuid,p_product uuid,p_file uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform 1 from auth.users where id=p_owner for update;
 perform pg_advisory_xact_lock(hashtextextended('profile-media:'||p_owner::text,0));
 delete from snoozer.product_files f using snoozer.product_drafts d where f.product_id=d.id and d.owner_id=p_owner
  and f.product_id=p_product and f.id=p_file and f.state='removing' and not exists(select 1 from storage.objects o
   where o.bucket_id='product-files' and o.name=f.media_scope::text||'/'||f.id::text||'.pdf');
 return found;
end $$;

create function public.find_orphan_product_files() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(name),'[]'::jsonb) from(select o.name from storage.objects o where o.bucket_id='product-files' and o.created_at<now()-interval '3 hours'
  and o.name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$' and not exists(select 1 from snoozer.product_files f where o.name=f.media_scope::text||'/'||f.id::text||'.pdf')
  order by o.created_at,o.name limit 100) garbage
$$;
revoke execute on function public.list_my_product_files(uuid),public.get_my_product_file(uuid),public.prepare_product_file(uuid,uuid,integer),public.commit_product_file(uuid,uuid,uuid),public.remove_my_product_file(uuid,uuid),public.complete_product_file_removal(uuid,uuid,uuid),public.find_orphan_product_files() from public,anon,authenticated,service_role;
grant execute on function public.list_my_product_files(uuid),public.get_my_product_file(uuid),public.remove_my_product_file(uuid,uuid) to authenticated;
grant execute on function public.prepare_product_file(uuid,uuid,integer),public.commit_product_file(uuid,uuid,uuid),public.complete_product_file_removal(uuid,uuid,uuid),public.find_orphan_product_files() to service_role;
commit;
