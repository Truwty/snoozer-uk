begin;
create table snoozer.product_versions (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references snoozer.product_drafts(id) on delete cascade,
 file_id uuid not null references snoozer.product_files(id) deferrable initially deferred,
 revision integer not null check(revision>=0),
 title text not null, description text not null, amount integer not null check(amount between 50 and 100000),
 currency text not null check(currency='gbp'), bytes integer not null check(bytes between 1 and 4194304),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'), created_at timestamptz not null default now(),
 unique(product_id,revision,file_id)
);
alter table snoozer.product_versions enable row level security;
revoke all on snoozer.product_versions from public,anon,authenticated,service_role;

create function snoozer.immutable_product_version() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Product versions cannot be edited' using errcode='42501'; end $$;
create trigger immutable_product_version before update on snoozer.product_versions for each row execute function snoozer.immutable_product_version();

create function public.list_my_product_versions(p_profile uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor) then raise exception 'Profile unavailable' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'productId',v.product_id,'fileId',v.file_id,'revision',v.revision,
  'title',v.title,'description',v.description,'amount',v.amount,'bytes',v.bytes,'sha256',v.sha256,'createdAt',v.created_at) order by v.created_at,v.id)
  from snoozer.product_versions v join snoozer.product_drafts d on d.id=v.product_id where d.profile_id=p_profile and d.owner_id=actor),'[]'::jsonb);
end $$;

create function public.freeze_product_version(p_owner uuid,p_product uuid,p_expected integer,p_file uuid,p_sha256 text) returns uuid
language plpgsql security definer set search_path='' as $$
declare item snoozer.product_drafts; file snoozer.product_files; existing snoozer.product_versions; result uuid;
begin
 if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' or p_expected is null or p_expected<0 then raise exception 'Invalid version' using errcode='22023'; end if;
 perform 1 from auth.users where id=p_owner and email_confirmed_at is not null for update;
 if not found then raise exception 'Verified owner required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('profile-media:'||p_owner::text,0));
 select * into item from snoozer.product_drafts where id=p_product and owner_id=p_owner for update;
 if not found then raise exception 'Product unavailable' using errcode='42501'; end if;
 if item.revision<>p_expected then raise exception 'Product changed' using errcode='40001'; end if;
 select f.* into file from snoozer.product_files f join snoozer.profiles p on p.media_scope=f.media_scope
  where f.product_id=p_product and f.id=p_file and f.state='ready' and p.id=item.profile_id and p.owner_id=p_owner for update of f;
 if not found or not exists(select 1 from storage.objects where bucket_id='product-files' and name=file.media_scope::text||'/'||file.id::text||'.pdf'
  and metadata->>'size'=file.bytes::text and metadata->>'mimetype'='application/pdf') then raise exception 'Ready file required' using errcode='P1211'; end if;
 select * into existing from snoozer.product_versions where product_id=p_product and revision=p_expected and file_id=p_file;
 if found then
  if existing.sha256<>p_sha256 then raise exception 'File content changed' using errcode='40001'; end if;
  return existing.id;
 end if;
 if (select count(*) from snoozer.product_versions where product_id=p_product)>=5 then raise exception 'Version limit reached' using errcode='P1212'; end if;
 insert into snoozer.product_versions(product_id,file_id,revision,title,description,amount,currency,bytes,sha256)
  values(item.id,file.id,item.revision,item.title,item.description,item.amount,item.currency,file.bytes,p_sha256) returning id into result;
 return result;
end $$;

create function public.discard_my_product_version(p_product uuid,p_version uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 perform 1 from auth.users where id=actor for update;
 perform pg_advisory_xact_lock(hashtextextended('profile-media:'||actor::text,0));
 delete from snoozer.product_versions v using snoozer.product_drafts d where v.product_id=d.id and d.owner_id=actor and d.id=p_product and v.id=p_version;
 return found;
end $$;

create function snoozer.retain_versioned_product_file() returns trigger language plpgsql set search_path='' as $$
begin
 if new.state='removing' and exists(select 1 from snoozer.product_versions where file_id=old.id) then
  raise exception 'Discard private versions before removing their file' using errcode='P1211';
 end if;
 return new;
end $$;
create trigger retain_versioned_product_file before update of state on snoozer.product_files for each row execute function snoozer.retain_versioned_product_file();
revoke execute on function snoozer.immutable_product_version(),snoozer.retain_versioned_product_file(),public.list_my_product_versions(uuid),public.freeze_product_version(uuid,uuid,integer,uuid,text),public.discard_my_product_version(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.list_my_product_versions(uuid),public.discard_my_product_version(uuid,uuid) to authenticated;
grant execute on function public.freeze_product_version(uuid,uuid,integer,uuid,text) to service_role;
commit;
