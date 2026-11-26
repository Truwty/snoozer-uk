begin;

create table snoozer.image_host_text_pastes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (octet_length(body) between 1 and 16384),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index image_host_text_pastes_owner on snoozer.image_host_text_pastes(owner_id,updated_at desc);
alter table snoozer.image_host_text_pastes enable row level security;
revoke all on snoozer.image_host_text_pastes from public,anon,authenticated,service_role;

create function public.list_my_image_host_text_pastes() returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare actor uuid:=snoozer.verified_user();
begin
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'body',body,
   'is_public',is_public,'created_at',created_at,'updated_at',updated_at) order by updated_at desc)
   from snoozer.image_host_text_pastes where owner_id=actor),'[]'::jsonb);
end $$;

create function public.create_my_image_host_text_paste(p_title text,p_body text,p_is_public boolean) returns uuid
language plpgsql security definer set search_path to '' as $$
declare actor uuid:=snoozer.verified_user(); created uuid;
begin
 if p_title is null or char_length(btrim(p_title)) not between 1 and 80
   or p_body is null or octet_length(p_body) not between 1 and 16384 or p_is_public is null then
   raise exception 'Invalid text paste' using errcode='22023';
 end if;
 perform 1 from auth.users where id=actor for update;
 if (select count(*) from snoozer.image_host_text_pastes where owner_id=actor)>=25 then
   raise exception 'Text paste limit reached' using errcode='P1210';
 end if;
 insert into snoozer.image_host_text_pastes(owner_id,title,body,is_public)
 values(actor,btrim(p_title),p_body,p_is_public) returning id into created;
 return created;
end $$;

create function public.update_my_image_host_text_paste(p_id uuid,p_title text,p_body text,p_is_public boolean) returns boolean
language plpgsql security definer set search_path to '' as $$
declare actor uuid:=snoozer.verified_user(); changed integer;
begin
 if p_id is null or p_title is null or char_length(btrim(p_title)) not between 1 and 80
   or p_body is null or octet_length(p_body) not between 1 and 16384 or p_is_public is null then
   raise exception 'Invalid text paste' using errcode='22023';
 end if;
 update snoozer.image_host_text_pastes set title=btrim(p_title),body=p_body,is_public=p_is_public,updated_at=now()
 where id=p_id and owner_id=actor;
 get diagnostics changed=row_count;
 return changed=1;
end $$;

create function public.delete_my_image_host_text_paste(p_id uuid) returns boolean
language plpgsql security definer set search_path to '' as $$
declare actor uuid:=snoozer.verified_user(); changed integer;
begin
 delete from snoozer.image_host_text_pastes where id=p_id and owner_id=actor;
 get diagnostics changed=row_count;
 return changed=1;
end $$;

create function public.get_public_image_host_text_paste(p_id uuid) returns jsonb
language sql stable security definer set search_path to '' as $$
 select jsonb_build_object('title',title,'body',body,'updated_at',updated_at)
 from snoozer.image_host_text_pastes where id=p_id and is_public
$$;

revoke all on function public.list_my_image_host_text_pastes(),
 public.create_my_image_host_text_paste(text,text,boolean),
 public.update_my_image_host_text_paste(uuid,text,text,boolean),
 public.delete_my_image_host_text_paste(uuid),public.get_public_image_host_text_paste(uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.list_my_image_host_text_pastes(),
 public.create_my_image_host_text_paste(text,text,boolean),
 public.update_my_image_host_text_paste(uuid,text,text,boolean),
 public.delete_my_image_host_text_paste(uuid) to authenticated;
grant execute on function public.get_public_image_host_text_paste(uuid) to anon,authenticated;

commit;
