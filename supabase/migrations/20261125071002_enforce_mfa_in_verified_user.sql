-- Enforce TOTP assurance inside every RPC that relies on verified_user().
begin;
create or replace function snoozer.verified_user() returns uuid
language plpgsql stable set search_path='' as $$
declare
 actor uuid:=auth.uid();
 claims jsonb:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
 sid text:=claims->>'session_id';
 has_totp boolean:=false;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then
  raise exception 'Verified account required' using errcode='42501';
 end if;
 if sid is not null and (sid !~ '^[0-9a-f-]{36}$'
   or not exists(select 1 from auth.sessions where id=sid::uuid and user_id=actor and (not_after is null or not_after>now()))) then
  raise exception 'Session revoked or expired' using errcode='42501';
 end if;
 if to_regclass('auth.mfa_factors') is not null then
  execute 'select exists(select 1 from auth.mfa_factors f where f.user_id=$1 and f.factor_type::text = ''totp'' and f.status::text = ''verified'')'
   into has_totp using actor;
 end if;
 if has_totp and coalesce(claims->>'aal','aal1')<>'aal2' then
  raise exception 'Second factor verification required' using errcode='42501';
 end if;
 if not exists(select 1 from snoozer.platform_owners where owner_id=actor)
  and exists(select 1 from snoozer.account_restrictions r where r.user_id=actor
   and r.revoked_at is null and (r.ends_at is null or r.ends_at>now())) then
  raise exception 'Account temporarily restricted' using errcode='42501';
 end if;
 return actor;
end $$;
revoke all on function snoozer.verified_user() from public,anon,authenticated,service_role;
commit;
