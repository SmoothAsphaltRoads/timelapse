-- MVP schema for study verification platform

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'session_status') then
    create type public.session_status as enum (
      'active',
      'interrupted',
      'encoding',
      'encode_failed',
      'uploading',
      'uploaded',
      'cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'upload_status') then
    create type public.upload_status as enum (
      'not_started',
      'in_progress',
      'failed',
      'completed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'event_type') then
    create type public.event_type as enum (
      'session_started',
      'screen_share_started',
      'screen_share_ended',
      'tab_hidden',
      'tab_visible',
      'network_offline',
      'network_online',
      'encoding_started',
      'encoding_finished',
      'upload_started',
      'upload_finished',
      'upload_failed',
      'session_resumed',
      'session_finalized'
    );
  end if;
end$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 32),
  display_name text not null default '',
  avatar_url text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  status public.session_status not null default 'active',
  upload_state public.upload_status not null default 'not_started',

  started_at timestamptz not null default now(),
  ended_at timestamptz,
  total_duration_sec integer not null default 0 check (total_duration_sec >= 0),

  active_capture_interval_sec integer not null default 45 check (active_capture_interval_sec >= 1),
  inactive_capture_interval_sec integer not null default 300 check (inactive_capture_interval_sec >= 1),

  captured_frames_count integer not null default 0 check (captured_frames_count >= 0),
  skipped_similar_frames_count integer not null default 0 check (skipped_similar_frames_count >= 0),

  encode_started_at timestamptz,
  encode_finished_at timestamptz,
  encode_error text,

  upload_started_at timestamptz,
  upload_finished_at timestamptz,
  upload_error text,

  r2_bucket text,
  r2_object_key text unique,
  r2_etag text,
  mp4_size_bytes bigint check (mp4_size_bytes >= 0),
  mp4_sha256 text,

  last_client_heartbeat_at timestamptz,
  interruption_count integer not null default 0 check (interruption_count >= 0),

  client_platform text,
  client_browser text,
  client_app_version text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.session_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.study_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type public.event_type not null,
  event_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  skip_similar_frames boolean not null default true,
  similarity_threshold numeric(5,4) not null default 0.9800 check (similarity_threshold > 0 and similarity_threshold <= 1),
  preferred_fps integer not null default 30 check (preferred_fps between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_study_sessions_user_started_at
  on public.study_sessions (user_id, started_at desc);

create index if not exists idx_study_sessions_status
  on public.study_sessions (status);

create index if not exists idx_session_events_session_at
  on public.session_events (session_id, event_at asc);

create or replace view public.leaderboard_daily as
select
  s.user_id,
  date_trunc('day', s.started_at)::date as study_day,
  sum(s.total_duration_sec)::bigint as total_duration_sec
from public.study_sessions s
where s.status = 'uploaded'
group by s.user_id, date_trunc('day', s.started_at)::date;

alter table public.profiles enable row level security;
alter table public.study_sessions enable row level security;
alter table public.session_events enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "profiles_select_own_or_public" on public.profiles;
create policy "profiles_select_own_or_public"
on public.profiles
for select
using (true);

drop policy if exists "profiles_upsert_own" on public.profiles;
create policy "profiles_upsert_own"
on public.profiles
for all
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "sessions_select_own" on public.study_sessions;
create policy "sessions_select_own"
on public.study_sessions
for select
using (auth.uid() = user_id);

drop policy if exists "sessions_insert_own" on public.study_sessions;
create policy "sessions_insert_own"
on public.study_sessions
for insert
with check (auth.uid() = user_id);

drop policy if exists "sessions_update_own" on public.study_sessions;
create policy "sessions_update_own"
on public.study_sessions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "events_select_own" on public.session_events;
create policy "events_select_own"
on public.session_events
for select
using (auth.uid() = user_id);

drop policy if exists "events_insert_own" on public.session_events;
create policy "events_insert_own"
on public.session_events
for insert
with check (auth.uid() = user_id);

drop policy if exists "settings_select_own" on public.user_settings;
create policy "settings_select_own"
on public.user_settings
for select
using (auth.uid() = user_id);

drop policy if exists "settings_upsert_own" on public.user_settings;
create policy "settings_upsert_own"
on public.user_settings
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
