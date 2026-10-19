-- YEGO platform — initial schema (PostgreSQL 15+)
-- All operational records live here. No browser storage is authoritative.

create table if not exists schema_migrations (
  version text primary key,
  checksum text not null,
  applied_at timestamptz not null default now()
);

-- Reference geography -------------------------------------------------------
create table if not exists states (
  code text primary key,
  name text not null unique,
  capital text not null,
  zone text not null,
  lat double precision not null,
  lng double precision not null,
  polling_units integer not null default 0 check (polling_units >= 0),
  wards integer not null default 0 check (wards >= 0)
);

create table if not exists lgas (
  id bigserial primary key,
  state_code text not null references states(code) on delete cascade,
  name text not null,
  unique (state_code, name)
);

-- Official polling units are imported from INEC; never fabricated here.
create table if not exists polling_units (
  id uuid primary key default gen_random_uuid(),
  state_code text not null references states(code),
  lga text not null,
  ward text not null,
  code text not null unique,
  name text not null,
  lat double precision,
  lng double precision,
  source text not null default 'manual',
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

-- Applications --------------------------------------------------------------
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  yego_id text unique,
  full_name text not null,
  gender text not null check (gender in ('Female', 'Male')),
  date_of_birth date not null,
  phone text not null,
  whatsapp text not null,
  email text not null,
  nin_ciphertext text,
  nin_last4 text,
  state_of_origin text not null,
  state_of_residence text not null,
  lga text not null,
  ward text not null,
  preferred_polling_unit text,
  polling_unit text not null default 'To be assigned',
  background text not null,
  experience text not null default '',
  photo_data text,
  status text not null default 'Application Submitted'
    check (status in (
      'Application Submitted', 'Under Review', 'Screening', 'Approved',
      'Training Required', 'Training Completed', 'Certified/Active', 'Not Approved'
    )),
  whatsapp_confirmed_at timestamptz,
  training_progress integer not null default 0 check (training_progress between 0 and 100),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists applications_status_idx on applications(status);
create index if not exists applications_geo_idx on applications(state_of_residence, lga);
create index if not exists applications_phone_idx on applications(phone);
create index if not exists applications_submitted_idx on applications(submitted_at desc);

create table if not exists application_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  action text not null,
  from_status text,
  to_status text,
  note text,
  actor_user_id uuid,
  actor_label text not null default 'System',
  created_at timestamptz not null default now()
);
create index if not exists application_history_app_idx on application_history(application_id, created_at);

create table if not exists consent_records (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  kind text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  ip text,
  user_agent text
);

-- Users, sessions and access ------------------------------------------------
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  name text not null,
  role text not null check (role in (
    'Super Administrator', 'National YEGO Administrator', 'Regional Coordinator',
    'State Coordinator', 'LGA Coordinator', 'Verification Officer',
    'Training Officer', 'YEGO Guard', 'Partner/Observer'
  )),
  kind text not null check (kind in ('command', 'guard')),
  scope_kind text not null check (scope_kind in ('national', 'zone', 'state', 'lga', 'self', 'training')),
  scope_zone text,
  scope_state text,
  scope_lga text,
  application_id uuid references applications(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists users_email_lower_idx on users(lower(email));
create unique index if not exists users_application_idx on users(application_id) where application_id is not null;

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ip text,
  user_agent text
);
create index if not exists sessions_user_idx on sessions(user_id);
create index if not exists sessions_expiry_idx on sessions(expires_at);

create table if not exists login_attempts (
  id bigserial primary key,
  email text not null,
  ip text,
  success boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists login_attempts_email_idx on login_attempts(email, created_at desc);

-- Incidents -----------------------------------------------------------------
create table if not exists incidents (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  type text not null,
  description text not null,
  severity text not null check (severity in ('Low', 'Medium', 'High', 'Critical')),
  state text not null,
  lga text not null,
  ward text not null,
  polling_unit text not null,
  lat double precision not null,
  lng double precision not null,
  occurred_at timestamptz not null,
  reported_at timestamptz not null default now(),
  reporter_name text not null,
  reporter_id text not null,
  reporter_user_id uuid references users(id) on delete set null,
  status text not null default 'Reported'
    check (status in ('Reported', 'Received', 'Under Review', 'Verified', 'Unverified', 'Referred/Actioned', 'Closed')),
  category text,
  election_day boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists incidents_status_idx on incidents(status);
create index if not exists incidents_geo_idx on incidents(state, lga);
create index if not exists incidents_reported_idx on incidents(reported_at desc);
create index if not exists incidents_reporter_idx on incidents(reporter_user_id);

create table if not exists incident_evidence (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  kind text not null check (kind in ('photo', 'video', 'document')),
  file_name text not null,
  storage_key text,
  mime_type text,
  byte_size bigint,
  created_at timestamptz not null default now()
);

create table if not exists incident_history (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  action text not null,
  from_status text,
  to_status text,
  note text,
  actor_user_id uuid,
  actor_label text not null default 'System',
  created_at timestamptz not null default now()
);
create index if not exists incident_history_incident_idx on incident_history(incident_id, created_at);

create table if not exists incident_referrals (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  agency_code text not null,
  agency_name text not null,
  note text,
  status text not null default 'pending_manual'
    check (status in ('pending_manual', 'sent', 'acknowledged', 'failed', 'closed')),
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists incident_referrals_incident_idx on incident_referrals(incident_id);

create table if not exists referral_events (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references incident_referrals(id) on delete cascade,
  event text not null,
  detail text,
  actor_user_id uuid,
  created_at timestamptz not null default now()
);

-- Early warning -------------------------------------------------------------
create table if not exists early_warnings (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  type text not null,
  title text not null,
  summary text not null,
  state text not null,
  lga text not null,
  level text not null default 'Watch' check (level in ('Watch', 'Alert', 'Urgent')),
  access text not null default 'Command only'
    check (access in ('Command only', 'State coordinators', 'All Guards in area')),
  raised_by_user_id uuid references users(id) on delete set null,
  raised_by_label text not null,
  evidence_count integer not null default 0,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);
create index if not exists early_warnings_geo_idx on early_warnings(state, lga);
create index if not exists early_warnings_created_idx on early_warnings(created_at desc);

-- Training ------------------------------------------------------------------
create table if not exists training_attempts (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  module_id text not null,
  answers jsonb not null,
  score integer not null default 0,
  passed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists training_attempts_app_idx on training_attempts(application_id, created_at);

create table if not exists certificates (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references applications(id) on delete cascade,
  certificate_no text not null unique,
  issued_at timestamptz not null default now(),
  issued_by uuid references users(id) on delete set null
);

create table if not exists check_ins (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  polling_unit text not null,
  lat double precision,
  lng double precision,
  checked_in_at timestamptz not null default now()
);
create index if not exists check_ins_app_idx on check_ins(application_id, checked_in_at desc);

-- Communication -------------------------------------------------------------
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  from_label text not null,
  tier text not null check (tier in ('National Command', 'Regional/State', 'LGA/Field')),
  kind text not null check (kind in ('Announcement', 'Operational instruction', 'Alert', 'Training', 'Emergency')),
  title text not null,
  body text not null,
  audience text not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists announcements_created_idx on announcements(created_at desc);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  entity_type text,
  entity_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx on notifications(user_id) where read_at is null;

create table if not exists audit_log (
  id bigserial primary key,
  actor_user_id uuid references users(id) on delete set null,
  actor_label text not null default 'System',
  action text not null,
  entity_type text,
  entity_id text,
  outcome text not null default 'success',
  detail jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on audit_log(created_at desc);

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- updated_at maintenance ----------------------------------------------------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists applications_updated_at on applications;
create trigger applications_updated_at before update on applications
  for each row execute function set_updated_at();

drop trigger if exists users_updated_at on users;
create trigger users_updated_at before update on users
  for each row execute function set_updated_at();

drop trigger if exists incidents_updated_at on incidents;
create trigger incidents_updated_at before update on incidents
  for each row execute function set_updated_at();

drop trigger if exists referrals_updated_at on incident_referrals;
create trigger referrals_updated_at before update on incident_referrals
  for each row execute function set_updated_at();
