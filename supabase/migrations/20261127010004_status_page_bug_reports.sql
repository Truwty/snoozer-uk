begin;

create table public.status_bug_reports (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  category text not null check (category in ('bug', 'visual', 'account', 'payments', 'other')),
  title text not null check (char_length(title) between 6 and 120),
  description text not null check (char_length(description) between 20 and 3000),
  steps text not null default '' check (char_length(steps) <= 2500),
  page_path text not null check (page_path ~ '^/[[:graph:]]*$' and page_path not like '//%' and page_path !~ '[?#]'),
  browser_info text not null default '' check (char_length(browser_info) <= 500),
  contact_email text check (contact_email is null or (
    char_length(contact_email) <= 254 and position('@' in contact_email) > 1
  )),
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved', 'ignored')),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index status_bug_reports_created_idx
  on public.status_bug_reports (created_at desc);
create index status_bug_reports_status_created_idx
  on public.status_bug_reports (status, created_at desc);

create table public.status_bug_report_rate_limits (
  request_fingerprint text primary key check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count between 1 and 10000)
);

alter table public.status_bug_reports enable row level security;
alter table public.status_bug_report_rate_limits enable row level security;

revoke all on table public.status_bug_reports from public, anon, authenticated, service_role;
revoke all on table public.status_bug_report_rate_limits from public, anon, authenticated, service_role;
grant select, insert, update on table public.status_bug_reports to service_role;
grant select, insert, update, delete on table public.status_bug_report_rate_limits to service_role;

create function public.submit_status_bug_report(
  p_request_fingerprint text,
  p_category text,
  p_title text,
  p_description text,
  p_steps text,
  p_page_path text,
  p_browser_info text,
  p_contact_email text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  current_count integer;
  new_report_id uuid;
begin
  if p_request_fingerprint is null or p_request_fingerprint !~ '^[0-9a-f]{64}$'
    or p_category is null or p_category not in ('bug', 'visual', 'account', 'payments', 'other')
    or p_title is null or pg_catalog.char_length(pg_catalog.btrim(p_title)) not between 6 and 120
    or p_description is null or pg_catalog.char_length(pg_catalog.btrim(p_description)) not between 20 and 3000
    or p_steps is null or pg_catalog.char_length(p_steps) > 2500
    or p_page_path is null or p_page_path !~ '^/[[:graph:]]*$' or p_page_path like '//%' or p_page_path ~ '[?#]'
    or p_browser_info is null or pg_catalog.char_length(p_browser_info) > 500
    or (p_contact_email is not null and (
      pg_catalog.char_length(p_contact_email) > 254
      or position('@' in p_contact_email) < 2
    )) then
    raise exception 'invalid_status_bug_report' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('status-bug-report:' || p_request_fingerprint, 0)
  );

  insert into public.status_bug_report_rate_limits (
    request_fingerprint, window_started_at, request_count
  ) values (p_request_fingerprint, pg_catalog.now(), 1)
  on conflict (request_fingerprint) do update set
    window_started_at = case
      when public.status_bug_report_rate_limits.window_started_at <= pg_catalog.now() - interval '1 hour'
        then pg_catalog.now()
      else public.status_bug_report_rate_limits.window_started_at
    end,
    request_count = case
      when public.status_bug_report_rate_limits.window_started_at <= pg_catalog.now() - interval '1 hour'
        then 1
      else public.status_bug_report_rate_limits.request_count + 1
    end
  returning request_count into current_count;

  if current_count > 3 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.status_bug_reports (
    category, title, description, steps, page_path, browser_info, contact_email
  ) values (
    p_category,
    pg_catalog.btrim(p_title),
    pg_catalog.btrim(p_description),
    pg_catalog.btrim(p_steps),
    p_page_path,
    p_browser_info,
    nullif(pg_catalog.btrim(p_contact_email), '')
  )
  returning id into new_report_id;

  delete from public.status_bug_report_rate_limits
  where window_started_at < pg_catalog.now() - interval '2 days';

  return new_report_id;
end
$$;

revoke all on function public.submit_status_bug_report(text, text, text, text, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_status_bug_report(text, text, text, text, text, text, text, text)
  to service_role;

commit;
