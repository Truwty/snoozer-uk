-- Feature #20: exact, read-only provider-ban readiness and privacy FK inventory.
-- Authorisation is enforced within the database, never from user metadata.

create function public.owner_provider_ban_preflight(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor();
begin
 return jsonb_build_object(
  'user_exists', exists(select 1 from auth.users where id=p_user),
  'is_owner', exists(select 1 from snoozer.platform_owners where owner_id=p_user),
  'internal_ban', exists(select 1 from snoozer.account_restrictions
    where user_id=p_user and kind='ban' and revoked_at is null
    and (ends_at is null or ends_at>now())),
  'active_restriction', exists(select 1 from snoozer.account_restrictions
    where user_id=p_user and revoked_at is null
    and (ends_at is null or ends_at>now())),
  'auth_banned', coalesce((select banned_until>now() from auth.users where id=p_user),false),
  'eligible_cases', coalesce((
    select jsonb_agg(jsonb_build_object('id',c.id,'status',c.status) order by c.created_at desc)
    from (select id,status,created_at from snoozer.moderation_cases
      where target_id=p_user and status in ('actioned','closed','appealed')
      order by created_at desc limit 100) c
  ),'[]'::jsonb)
 );
end $$;
revoke all on function public.owner_provider_ban_preflight(uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.owner_provider_ban_preflight(uuid) to authenticated;

-- Enumerate direct application foreign keys to an Auth user for an Owner
-- reviewing a privacy request. This is a preflight, NOT erasure.
-- Indirect ownership through profiles/products, Storage objects and external
-- processors must also be inventoried and fulfilled separately.
create function public.owner_privacy_dependency_inventory(p_request uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor(); subject uuid;
 relation record; row_count bigint; item jsonb;
 dependencies jsonb := '[]'::jsonb; sum_rows bigint := 0;
begin
 select user_id into subject from snoozer.privacy_requests where id=p_request;
 if not found then return null; end if;
 for relation in
  select cls.oid as relid, ns.nspname as schema_name, cls.relname as table_name,
   att.attname as column_name, pg_get_constraintdef(con.oid) as rule
  from pg_constraint con
   join pg_class cls on cls.oid=con.conrelid
   join pg_namespace ns on ns.oid=cls.relnamespace
   join pg_attribute att on att.attrelid=cls.oid and att.attnum=con.conkey[1]
  where con.contype='f' and con.confrelid='auth.users'::regclass
   and array_length(con.conkey,1)=1 and ns.nspname='snoozer'
  order by ns.nspname,cls.relname,att.attname
 loop
  execute format('select count(*) from %s where %I=$1',
    relation.relid::regclass,relation.column_name) into row_count using subject;
  if row_count>0 then
   item:=jsonb_build_object('table',relation.schema_name||'.'||relation.table_name,
     'column',relation.column_name,'rows',row_count,
     'on_delete',case when relation.rule like '%ON DELETE CASCADE%' then 'cascade'
                      when relation.rule like '%ON DELETE SET NULL%' then 'set_null'
                      when relation.rule like '%ON DELETE RESTRICT%' then 'restrict'
                      else 'no_action' end);
   dependencies:=dependencies||jsonb_build_array(item);
   sum_rows:=sum_rows+row_count;
  end if;
 end loop;
 return jsonb_build_object('request_id',p_request,'user_id',subject,
  'direct_fk_matches',sum_rows,'dependencies',dependencies,
  'scope','Direct snoozer-table foreign keys to auth.users only. Does not include all app, Storage, Stripe, Zoho, historic or indirectly linked personal data. Read-only; no deletion.');
end $$;
revoke all on function public.owner_privacy_dependency_inventory(uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.owner_privacy_dependency_inventory(uuid) to authenticated;
