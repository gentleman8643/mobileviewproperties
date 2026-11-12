-- =====================================================================
-- Mobile View Properties - Customer Application & Admin System
-- ---------------------------------------------------------------------
-- SAFE TO RUN MORE THAN ONCE. This script only ADDS things.
-- It never drops tables, never deletes rows and never touches any
-- table that is not listed below.
-- Paste the whole file into Supabase > SQL Editor > New query > Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Admin users (links a Supabase Auth login to the admin role)
-- ---------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique,
  role       text not null default 'admin' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Is the currently logged-in user an administrator?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "admins read own admin row" on public.admin_users;
create policy "admins read own admin row" on public.admin_users
  for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2. Applications
-- ---------------------------------------------------------------------
create table if not exists public.applications (
  id                    uuid primary key default gen_random_uuid(),
  reference             text not null unique,
  client_submission_id  uuid not null unique,
  status                text not null default 'new' check (status in (
                          'new', 'contacted', 'under_review', 'quotation_prepared',
                          'quotation_sent', 'negotiating', 'approved',
                          'in_progress', 'completed', 'cancelled')),
  -- Key fields copied out of the answers so the dashboard can search/filter
  full_name             text not null,
  email                 text not null,
  phone                 text not null,
  alt_phone             text,
  preferred_contact     text,
  telegram              text,
  country               text,
  state                 text,
  city                  text,
  home_type             text,
  bedrooms              text,
  land_status           text,
  land_size             text,
  budget                text,
  purchase_method       text,
  purchase_readiness    text,
  needed_by             text,
  -- Every answer, exactly as submitted
  answers               jsonb not null,
  -- Signature (PNG image as a data URL, only readable by admins)
  signature_png         text not null,
  signature_name        text not null,
  signature_date        date not null,
  consent               boolean not null check (consent),
  submitted_at          timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  ip_hash               text,
  user_agent            text,
  admin_notified_at     timestamptz,
  customer_notified_at  timestamptz
);

create index if not exists applications_submitted_at_idx on public.applications (submitted_at desc);
create index if not exists applications_status_idx on public.applications (status);
create index if not exists applications_email_idx on public.applications (lower(email));

alter table public.applications enable row level security;

drop policy if exists "admins read applications" on public.applications;
create policy "admins read applications" on public.applications
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admins update applications" on public.applications;
create policy "admins update applications" on public.applications
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
-- No insert policy on purpose: customers can only submit through
-- public.submit_application() below, which validates everything.
-- No delete policy on purpose: records are never deleted from the website.
revoke insert, delete, truncate on public.applications from anon, authenticated;
revoke all on public.applications from anon;

-- ---------------------------------------------------------------------
-- 3. Uploaded documents / photos
-- ---------------------------------------------------------------------
create table if not exists public.application_documents (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  category       text not null check (category in ('land_photos', 'land_documents', 'design_images', 'extra_documents')),
  storage_path   text not null unique,
  file_name      text not null,
  mime_type      text,
  size_bytes     bigint,
  uploaded_at    timestamptz not null default now()
);

create index if not exists application_documents_app_idx on public.application_documents (application_id);

alter table public.application_documents enable row level security;

drop policy if exists "admins read documents" on public.application_documents;
create policy "admins read documents" on public.application_documents
  for select to authenticated
  using (public.is_admin());
revoke all on public.application_documents from anon;
revoke insert, update, delete, truncate on public.application_documents from authenticated;

-- ---------------------------------------------------------------------
-- 4. Status history (filled automatically by triggers)
-- ---------------------------------------------------------------------
create table if not exists public.application_status_history (
  id             bigint generated always as identity primary key,
  application_id uuid not null references public.applications (id) on delete cascade,
  old_status     text,
  new_status     text not null,
  changed_by     uuid references auth.users (id) on delete set null,
  changed_at     timestamptz not null default now()
);

create index if not exists application_status_history_app_idx on public.application_status_history (application_id);

alter table public.application_status_history enable row level security;

drop policy if exists "admins read status history" on public.application_status_history;
create policy "admins read status history" on public.application_status_history
  for select to authenticated
  using (public.is_admin());
revoke all on public.application_status_history from anon;
revoke insert, update, delete, truncate on public.application_status_history from authenticated;

-- Before an admin update: block edits to the customer's answers, stamp updated_at.
create or replace function public.before_application_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.answers is distinct from old.answers
     or new.signature_png is distinct from old.signature_png
     or new.signature_name is distinct from old.signature_name
     or new.reference is distinct from old.reference
     or new.client_submission_id is distinct from old.client_submission_id
     or new.full_name is distinct from old.full_name
     or new.email is distinct from old.email
     or new.phone is distinct from old.phone
     or new.submitted_at is distinct from old.submitted_at then
    raise exception 'Submitted customer answers cannot be edited';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- After insert/update: record the status change in the history table.
create or replace function public.after_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_status_history (application_id, old_status, new_status, changed_by)
    values (new.id, null, new.status, null);
  elsif new.status is distinct from old.status then
    insert into public.application_status_history (application_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return null;
end;
$$;

drop trigger if exists applications_before_update on public.applications;
create trigger applications_before_update
  before update on public.applications
  for each row execute function public.before_application_update();

drop trigger if exists applications_after_status on public.applications;
create trigger applications_after_status
  after insert or update of status on public.applications
  for each row execute function public.after_application_status_change();

-- ---------------------------------------------------------------------
-- 5. Internal admin notes
-- ---------------------------------------------------------------------
create table if not exists public.application_notes (
  id             bigint generated always as identity primary key,
  application_id uuid not null references public.applications (id) on delete cascade,
  note           text not null check (char_length(note) between 1 and 5000),
  author_id      uuid references auth.users (id) on delete set null default auth.uid(),
  author_name    text,
  created_at     timestamptz not null default now()
);

create index if not exists application_notes_app_idx on public.application_notes (application_id);

alter table public.application_notes enable row level security;

drop policy if exists "admins read notes" on public.application_notes;
create policy "admins read notes" on public.application_notes
  for select to authenticated using (public.is_admin());

drop policy if exists "admins add notes" on public.application_notes;
create policy "admins add notes" on public.application_notes
  for insert to authenticated with check (public.is_admin() and author_id = auth.uid());
revoke all on public.application_notes from anon;

-- ---------------------------------------------------------------------
-- 6. Business contact settings (one row, public read, admin edit)
--    Starts EMPTY on purpose - the admin fills it in from the dashboard.
-- ---------------------------------------------------------------------
create table if not exists public.business_settings (
  id               int primary key default 1 check (id = 1),
  business_name    text not null default 'Mobile View Properties',
  business_address text,
  phone_main       text,
  phone_alt        text,
  whatsapp         text,
  telegram         text,
  email            text,
  website_url      text,
  logo_url         text,
  updated_at       timestamptz not null default now()
);

insert into public.business_settings (id) values (1) on conflict (id) do nothing;

alter table public.business_settings enable row level security;

drop policy if exists "anyone reads business settings" on public.business_settings;
create policy "anyone reads business settings" on public.business_settings
  for select to anon, authenticated using (true);

drop policy if exists "admins update business settings" on public.business_settings;
create policy "admins update business settings" on public.business_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, update, delete, truncate on public.business_settings from anon;
revoke insert, delete, truncate on public.business_settings from authenticated;

-- ---------------------------------------------------------------------
-- 7. File storage
--    application-files : PRIVATE. Customers can upload, nobody but admins can read.
--    branding          : public (business logo only).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('application-files', 'application-files', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Customers (anyone) may only ADD files into incoming/<their-submission-id>/...
-- They can never list, read, replace or delete files.
drop policy if exists "public uploads application files" on storage.objects;
create policy "public uploads application files" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'application-files'
    and name ~ '^incoming/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]{1,160}$'
  );

drop policy if exists "admins read application files" on storage.objects;
create policy "admins read application files" on storage.objects
  for select to authenticated
  using (bucket_id = 'application-files' and public.is_admin());

drop policy if exists "admins manage branding" on storage.objects;
create policy "admins manage branding" on storage.objects
  for all to authenticated
  using (bucket_id = 'branding' and public.is_admin())
  with check (bucket_id = 'branding' and public.is_admin());

-- ---------------------------------------------------------------------
-- 8. The ONLY way customers can save an application.
--    Validates the data, blocks spam, prevents duplicates and returns
--    the reference number. Customers never get read access to the table.
-- ---------------------------------------------------------------------
create or replace function public.submit_application(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id   uuid;
  v_answers     jsonb := payload -> 'answers';
  v_files       jsonb := coalesce(payload -> 'files', '[]'::jsonb);
  v_sig         text  := payload ->> 'signature_png';
  v_sig_name    text  := nullif(btrim(payload ->> 'signature_name'), '');
  v_sig_date    date;
  v_email       text;
  v_name        text;
  v_phone       text;
  v_existing    record;
  v_ip          text;
  v_ip_hash     text;
  v_ref         text;
  v_app_id      uuid;
  v_submitted   timestamptz;
  v_file        jsonb;
  v_path        text;
  v_required    text;
begin
  -- Basic shape -------------------------------------------------------
  begin
    v_client_id := (payload ->> 'client_submission_id')::uuid;
  exception when others then
    raise exception 'Invalid submission id' using errcode = '22023';
  end;
  if v_client_id is null then
    raise exception 'Invalid submission id' using errcode = '22023';
  end if;

  -- Same submission sent twice (double tap / network retry) -> return the original
  select reference, submitted_at into v_existing
    from public.applications where client_submission_id = v_client_id;
  if found then
    return jsonb_build_object('reference', v_existing.reference,
                              'submitted_at', v_existing.submitted_at,
                              'duplicate', true);
  end if;

  -- Spam protection: hidden honeypot field + minimum time on the form
  if coalesce(payload ->> 'hp', '') <> '' then
    raise exception 'Submission rejected' using errcode = '22023';
  end if;
  if coalesce((payload ->> 'elapsed_ms')::bigint, 0) < 10000 then
    raise exception 'Submission rejected: form completed too quickly' using errcode = '22023';
  end if;

  if v_answers is null or jsonb_typeof(v_answers) <> 'object' then
    raise exception 'Missing answers' using errcode = '22023';
  end if;
  if pg_column_size(v_answers) > 100000 then
    raise exception 'Answers are too large' using errcode = '22023';
  end if;

  v_name  := nullif(btrim(v_answers ->> 'full_name'), '');
  v_email := lower(nullif(btrim(v_answers ->> 'email'), ''));
  v_phone := nullif(btrim(v_answers ->> 'phone'), '');

  if v_name is null or char_length(v_name) not between 2 and 150 then
    raise exception 'Please enter your full legal name' using errcode = '22023';
  end if;
  if v_email is null or char_length(v_email) > 254
     or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address' using errcode = '22023';
  end if;
  if v_phone is null or char_length(v_phone) not between 6 and 40
     or v_phone !~ '^[0-9+()\-.\s]+$' then
    raise exception 'Please enter a valid phone number' using errcode = '22023';
  end if;

  foreach v_required in array array['address', 'city', 'state', 'zip', 'country',
      'preferred_contact', 'home_type', 'interest', 'bedrooms', 'bathrooms', 'home_size',
      'land_status', 'foundation', 'exterior', 'interior', 'budget', 'purchase_method',
      'payment_methods', 'needed_by', 'begin_by', 'proceed_ready']
  loop
    if v_answers -> v_required is null
       or v_answers ->> v_required = ''
       or v_answers -> v_required = '[]'::jsonb then
      raise exception 'Missing required answer: %', v_required using errcode = '22023';
    end if;
  end loop;

  if (payload ->> 'consent') is distinct from 'true' then
    raise exception 'Consent is required' using errcode = '22023';
  end if;

  if v_sig is null or v_sig not like 'data:image/png;base64,%'
     or char_length(v_sig) not between 500 and 700000 then
    raise exception 'A drawn signature is required' using errcode = '22023';
  end if;
  if v_sig_name is null or char_length(v_sig_name) > 150 then
    raise exception 'Please type your full name next to your signature' using errcode = '22023';
  end if;
  begin
    v_sig_date := (payload ->> 'signature_date')::date;
  exception when others then
    v_sig_date := null;
  end;
  if v_sig_date is null or v_sig_date not between current_date - 2 and current_date + 2 then
    v_sig_date := current_date;
  end if;

  -- Rate limits ---------------------------------------------------------
  begin
    v_ip := split_part(coalesce(
              current_setting('request.headers', true)::json ->> 'cf-connecting-ip',
              current_setting('request.headers', true)::json ->> 'x-forwarded-for',
              current_setting('request.headers', true)::json ->> 'x-real-ip', ''), ',', 1);
  exception when others then
    v_ip := '';
  end;
  v_ip_hash := case when btrim(v_ip) = '' then null else md5('mvp-app:' || btrim(v_ip)) end;

  if (select count(*) from public.applications
       where lower(email) = v_email and submitted_at > now() - interval '24 hours') >= 3 then
    raise exception 'We already received several applications from this email today. Please contact us directly.'
      using errcode = '22023';
  end if;
  if v_ip_hash is not null and (select count(*) from public.applications
       where ip_hash = v_ip_hash and submitted_at > now() - interval '1 hour') >= 8 then
    raise exception 'Too many applications from this connection. Please try again later.'
      using errcode = '22023';
  end if;

  -- Files must already be uploaded into this submission's own folder ---
  if jsonb_typeof(v_files) <> 'array' or jsonb_array_length(v_files) > 20 then
    raise exception 'Too many files' using errcode = '22023';
  end if;
  for v_file in select * from jsonb_array_elements(v_files) loop
    v_path := v_file ->> 'path';
    if v_path is null or v_path not like 'incoming/' || v_client_id::text || '/%'
       or (v_file ->> 'category') not in ('land_photos', 'land_documents', 'design_images', 'extra_documents')
       or not exists (select 1 from storage.objects o
                       where o.bucket_id = 'application-files' and o.name = v_path) then
      raise exception 'An uploaded file could not be verified. Please re-attach it.' using errcode = '22023';
    end if;
  end loop;

  -- Unique, human-friendly reference e.g. MVP-261112-7A3F9D ----------------
  loop
    v_ref := 'MVP-' || to_char(now() at time zone 'utc', 'YYMMDD') || '-'
             || upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from public.applications where reference = v_ref);
  end loop;

  insert into public.applications (
    reference, client_submission_id, full_name, email, phone, alt_phone,
    preferred_contact, telegram, country, state, city, home_type, bedrooms,
    land_status, land_size, budget, purchase_method, purchase_readiness, needed_by,
    answers, signature_png, signature_name, signature_date, consent, ip_hash, user_agent
  ) values (
    v_ref, v_client_id, v_name, v_email, v_phone,
    left(nullif(btrim(v_answers ->> 'alt_phone'), ''), 40),
    left(v_answers ->> 'preferred_contact', 60),
    left(nullif(btrim(v_answers ->> 'telegram'), ''), 80),
    left(coalesce(nullif(v_answers ->> 'country_other', ''), v_answers ->> 'country'), 80),
    left(v_answers ->> 'state', 80),
    left(v_answers ->> 'city', 80),
    left(v_answers ->> 'home_type', 80),
    left(v_answers ->> 'bedrooms', 20),
    left(v_answers ->> 'land_status', 120),
    left(case when v_answers ->> 'land_size' = 'Custom size'
              then concat_ws(' ', v_answers ->> 'land_size_custom', v_answers ->> 'land_unit')
              else v_answers ->> 'land_size' end, 80),
    left(case when v_answers ->> 'budget' = 'I would like to specify my own budget'
              then '$' || coalesce(v_answers ->> 'budget_custom', '?')
              else v_answers ->> 'budget' end, 80),
    left(v_answers ->> 'purchase_method', 120),
    left(v_answers ->> 'proceed_ready', 120),
    left(v_answers ->> 'needed_by', 80),
    v_answers, v_sig, v_sig_name, v_sig_date, true, v_ip_hash,
    left(payload ->> 'user_agent', 300)
  )
  returning id, submitted_at into v_app_id, v_submitted;

  insert into public.application_documents (application_id, category, storage_path, file_name, mime_type, size_bytes)
  select v_app_id, f ->> 'category', f ->> 'path',
         left(coalesce(nullif(f ->> 'file_name', ''), 'file'), 200),
         left(f ->> 'mime_type', 100),
         nullif(f ->> 'size', '')::bigint
    from jsonb_array_elements(v_files) f;

  return jsonb_build_object('reference', v_ref, 'submitted_at', v_submitted, 'duplicate', false);
end;
$$;

revoke all on function public.submit_application(jsonb) from public;
grant execute on function public.submit_application(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 9. Dashboard counters for admins
-- ---------------------------------------------------------------------
create or replace function public.application_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total',           count(*),
      'new_7_days',      count(*) filter (where submitted_at > now() - interval '7 days'),
      'awaiting_contact',count(*) filter (where status = 'new'),
      'under_review',    count(*) filter (where status = 'under_review'),
      'quotation_sent',  count(*) filter (where status in ('quotation_prepared', 'quotation_sent', 'negotiating')),
      'approved',        count(*) filter (where status in ('approved', 'in_progress')),
      'completed',       count(*) filter (where status = 'completed'),
      'cancelled',       count(*) filter (where status = 'cancelled'))
    from public.applications);
end;
$$;

revoke all on function public.application_stats() from public;
grant execute on function public.application_stats() to authenticated;

-- =====================================================================
-- Done. Next step: create the admin login (see supabase/create-admin.sql)
-- =====================================================================
