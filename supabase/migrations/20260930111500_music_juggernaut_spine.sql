begin;

create table if not exists public.jhadina_music_juggernaut_artist_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  artist_id text not null,
  kernel jsonb not null default '{}'::jsonb,
  evidence_refs text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jhadina_music_juggernaut_songs (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text not null,
  status text not null check (status in ('unreleased','released','catalog')),
  artist_conviction numeric not null default 0 check (artist_conviction between 0 and 1),
  rights_state text not null default 'review_required' check (rights_state in ('clear','review_required','blocked')),
  sections jsonb not null default '[]'::jsonb,
  release_date date,
  evidence_refs text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,id)
);

create table if not exists public.jhadina_music_juggernaut_experiments (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  song_id text not null,
  payload jsonb not null,
  status text not null check (status in ('planned','running','complete','stopped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,id)
);

create index if not exists jhadina_music_juggernaut_experiments_song_idx
  on public.jhadina_music_juggernaut_experiments(user_id,song_id);

create table if not exists public.jhadina_music_juggernaut_observations (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  experiment_id text not null,
  observed_at timestamptz not null,
  payload jsonb not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id,id),
  unique (user_id,idempotency_key)
);

create index if not exists jhadina_music_juggernaut_observations_experiment_idx
  on public.jhadina_music_juggernaut_observations(user_id,experiment_id,observed_at desc);

create table if not exists public.jhadina_music_juggernaut_fans (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  stage text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id,id)
);

create table if not exists public.jhadina_music_juggernaut_city_demand (
  user_id uuid not null references auth.users(id) on delete cascade,
  city text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id,city)
);

create table if not exists public.jhadina_music_juggernaut_breakouts (
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id text not null,
  payload jsonb not null,
  state text not null check (state in ('OPEN','COOLING','CLOSED')),
  updated_at timestamptz not null default now(),
  primary key (user_id,song_id)
);

create table if not exists public.jhadina_music_juggernaut_learnings (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  source_kind text not null,
  source_id text not null,
  finding text not null,
  confidence numeric not null check (confidence between 0 and 1),
  reusable_signals jsonb not null default '{}'::jsonb,
  evidence_refs text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (user_id,id)
);

create table if not exists public.jhadina_music_juggernaut_events (
  sequence_id bigint generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  correlation_id text not null,
  evidence_refs text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (sequence_id),
  unique (user_id,event_key)
);

create index if not exists jhadina_music_juggernaut_events_user_sequence_idx
  on public.jhadina_music_juggernaut_events(user_id,sequence_id desc);

alter table public.jhadina_music_juggernaut_artist_profiles enable row level security;
alter table public.jhadina_music_juggernaut_songs enable row level security;
alter table public.jhadina_music_juggernaut_experiments enable row level security;
alter table public.jhadina_music_juggernaut_observations enable row level security;
alter table public.jhadina_music_juggernaut_fans enable row level security;
alter table public.jhadina_music_juggernaut_city_demand enable row level security;
alter table public.jhadina_music_juggernaut_breakouts enable row level security;
alter table public.jhadina_music_juggernaut_learnings enable row level security;
alter table public.jhadina_music_juggernaut_events enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'jhadina_music_juggernaut_artist_profiles',
    'jhadina_music_juggernaut_songs',
    'jhadina_music_juggernaut_experiments',
    'jhadina_music_juggernaut_observations',
    'jhadina_music_juggernaut_fans',
    'jhadina_music_juggernaut_city_demand',
    'jhadina_music_juggernaut_breakouts',
    'jhadina_music_juggernaut_learnings',
    'jhadina_music_juggernaut_events'
  ]
  loop
    execute format('drop policy if exists %I_owner_all on public.%I',t,t);
    execute format(
      'create policy %I_owner_all on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t,t
    );
  end loop;
end $$;

commit;
