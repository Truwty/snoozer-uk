CREATE OR REPLACE FUNCTION snoozer.verified_user()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $$
declare actor uuid:=auth.uid(); sid text:=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id');
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then
  raise exception 'Verified account required' using errcode='42501';
 end if;
 if sid is not null and (sid !~ '^[0-9a-f-]{36}$'
   or not exists(select 1 from auth.sessions where id=sid::uuid and user_id=actor and (not_after is null or not_after>now()))) then
  raise exception 'Session revoked or expired' using errcode='42501';
 end if;
 if not exists(select 1 from snoozer.platform_owners where owner_id=actor)
  and exists(select 1 from snoozer.account_restrictions r where r.user_id=actor
   and r.revoked_at is null and (r.ends_at is null or r.ends_at>now())) then
  raise exception 'Account temporarily restricted' using errcode='42501';
 end if;
 return actor;
end $$;

CREATE OR REPLACE FUNCTION snoozer.admin_actor(p_write boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
declare actor uuid:=snoozer.verified_user(); sid text:=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id');
begin
 if not exists(select 1 from snoozer.platform_owners where owner_id=actor) then
  raise exception 'Owner access required' using errcode='42501';
 end if;
 if p_write and (coalesce((nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal'),'')<>'aal2' or sid is null or sid !~ '^[0-9a-f-]{36}$'
   or not exists(select 1 from auth.sessions where id=sid::uuid and user_id=actor and (not_after is null or not_after>now()))) then
  raise exception 'Active Owner MFA session required' using errcode='42501';
 end if;
 return actor;
end $$;