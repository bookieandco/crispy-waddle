-- MUSIC SECURITY: this schema alone MUST NOT enable authenticated access.
-- Create all objects in one transaction and enable owner RLS BEFORE commit.
-- Separate reviewed policies/grants are required for functional reads/writes.
begin;

create table if not exists music_sources (
  id text not null,
  user_id text not null,
  kind text not null,
  name text not null,
  external_account_id text,
  authorized boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists music_artists (
  id text not null,
  user_id text not null,
  name text not null,
  sort_name text,
  external_ids jsonb not null default '{}'::jsonb,
  primary key (user_id, id)
);

create table if not exists music_albums (
  id text not null,
  user_id text not null,
  title text not null,
  artist_ids jsonb not null default '[]'::jsonb,
  release_date date,
  artwork_id text,
  external_ids jsonb not null default '{}'::jsonb,
  primary key (user_id, id)
);

create table if not exists music_tracks (
  id text not null,
  user_id text not null,
  title text not null,
  artist_ids jsonb not null default '[]'::jsonb,
  album_id text,
  duration_ms integer,
  track_number integer,
  disc_number integer,
  isrc text,
  explicit boolean,
  artwork_id text,
  external_ids jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists music_tracks_user_title_idx on music_tracks (user_id, lower(title));
create index if not exists music_tracks_isrc_idx on music_tracks (user_id, isrc) where isrc is not null;

create table if not exists music_playlists (
  id text not null,
  user_id text not null,
  name text not null,
  track_ids jsonb not null default '[]'::jsonb,
  source_id text,
  primary key (user_id, id)
);

create table if not exists music_assets (
  id text not null,
  user_id text not null,
  track_id text not null,
  source_id text not null,
  kind text not null,
  uri text not null,
  mime_type text,
  codec text,
  bitrate integer,
  lossless boolean,
  duration_ms integer,
  provenance jsonb not null default '{}'::jsonb,
  primary key (user_id, id)
);

create table if not exists music_artwork (
  id text not null,
  user_id text not null,
  uri text not null,
  width integer,
  height integer,
  source text,
  primary key (user_id, id)
);

create table if not exists music_lyrics (
  id text not null,
  user_id text not null,
  track_id text not null,
  text text not null,
  synced boolean,
  source text,
  primary key (user_id, id)
);

create table if not exists music_listening_events (
  id text not null,
  user_id text not null,
  track_id text not null,
  source_id text,
  started_at timestamptz not null,
  ended_at timestamptz,
  position_ms integer,
  completed boolean not null default false,
  skipped boolean not null default false,
  primary key (user_id, id)
);

create index if not exists music_listening_user_started_idx on music_listening_events (user_id, started_at desc);

-- Fail CLOSED if this base schema is installed without the approved
-- MUSIC-SECURITY-ADMISSION policies. No user can access another's row.
alter table public.music_sources enable row level security;
alter table public.music_sources force row level security;
alter table public.music_artists enable row level security;
alter table public.music_artists force row level security;
alter table public.music_albums enable row level security;
alter table public.music_albums force row level security;
alter table public.music_tracks enable row level security;
alter table public.music_tracks force row level security;
alter table public.music_playlists enable row level security;
alter table public.music_playlists force row level security;
alter table public.music_assets enable row level security;
alter table public.music_assets force row level security;
alter table public.music_artwork enable row level security;
alter table public.music_artwork force row level security;
alter table public.music_lyrics enable row level security;
alter table public.music_lyrics force row level security;
alter table public.music_listening_events enable row level security;
alter table public.music_listening_events force row level security;

commit;
