-- TruckerOS core schema (Phase 0 prototype)
--
-- Mirrors the shape @jhadina/truckeros-core's repository interfaces expect.
-- No PostGIS dependency: the MVP does spatial filtering/sorting in application
-- code (see src/geo.ts haversineDistanceMeters), which is enough for a single
-- driver's nearby-places radius query and keeps this schema portable to any
-- plain Postgres instance, including Supabase's default database.
--
-- Run with: psql "$DATABASE_URL" -f 001_truckeros_core.sql
-- (idempotent — safe to re-run)

create table if not exists truckeros_drivers (
  id text primary key,
  name text not null,
  truck_type text not null,
  home_base_location text,
  current_latitude double precision,
  current_longitude double precision,
  preferred_radius_meters integer not null default 16093, -- ~10mi
  created_at timestamptz not null default now()
);

create table if not exists truckeros_locations (
  id text primary key,
  driver_id text not null references truckeros_drivers(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  heading double precision,
  speed double precision,
  recorded_at timestamptz not null default now()
);
create index if not exists truckeros_locations_driver_time_idx
  on truckeros_locations(driver_id, recorded_at desc);

create table if not exists truckeros_place_categories (
  slug text primary key,
  name text not null
);

create table if not exists truckeros_places (
  id text primary key,
  provider_id text not null,
  provider_name text not null, -- e.g. 'google_places' | 'mock_offline'
  name text not null,
  category_slug text not null references truckeros_place_categories(slug),
  latitude double precision not null,
  longitude double precision not null,
  address text,
  phone text,
  rating numeric(3, 2),
  is_open_now boolean, -- null when the provider does not report hours
  -- Truck attributes are split by trust tier so the UI never has to guess
  -- whether a flag came from the provider, a driver, or a heuristic guess.
  truck_attributes_verified jsonb not null default '{}'::jsonb,
  truck_attributes_user_reported jsonb not null default '{}'::jsonb,
  truck_attributes_inferred jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_name, provider_id)
);
create index if not exists truckeros_places_category_idx on truckeros_places(category_slug);
create index if not exists truckeros_places_lat_lng_idx on truckeros_places(latitude, longitude);

create table if not exists truckeros_saved_places (
  id text primary key,
  driver_id text not null references truckeros_drivers(id) on delete cascade,
  place_id text not null references truckeros_places(id) on delete cascade,
  saved_at timestamptz not null default now(),
  unique (driver_id, place_id)
);

create table if not exists truckeros_preferences (
  id text primary key,
  driver_id text not null references truckeros_drivers(id) on delete cascade,
  key text not null,
  value text not null,
  weight integer not null default 1,
  source_memory_id text,
  updated_at timestamptz not null default now(),
  unique (driver_id, key, value)
);

create table if not exists truckeros_recommendations (
  id text primary key,
  driver_id text not null references truckeros_drivers(id) on delete cascade,
  place_id text not null references truckeros_places(id) on delete cascade,
  run_context jsonb not null, -- { latitude, longitude, radiusMeters, category, rankScore }
  generated_at timestamptz not null default now()
);
create index if not exists truckeros_recommendations_driver_idx
  on truckeros_recommendations(driver_id, generated_at desc);

create table if not exists truckeros_interactions (
  id text primary key,
  driver_id text not null references truckeros_drivers(id) on delete cascade,
  place_id text references truckeros_places(id) on delete set null,
  recommendation_id text references truckeros_recommendations(id) on delete set null,
  event_type text not null check (event_type in
    ('viewed', 'navigated', 'saved', 'dismissed', 'liked', 'disliked')),
  notes text,
  occurred_at timestamptz not null default now()
);
create index if not exists truckeros_interactions_driver_idx
  on truckeros_interactions(driver_id, occurred_at desc);

create table if not exists truckeros_memory_candidates (
  id text primary key,
  driver_id text not null references truckeros_drivers(id) on delete cascade,
  observation_text text not null,
  proposed_preference jsonb not null, -- { key, value, weight }
  triggered_by text not null, -- e.g. 'interaction:saved:place_123'
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists truckeros_memory_candidates_driver_status_idx
  on truckeros_memory_candidates(driver_id, status);

create table if not exists truckeros_memories (
  id text primary key,
  driver_id text not null references truckeros_drivers(id) on delete cascade,
  memory_candidate_id text references truckeros_memory_candidates(id) on delete set null,
  compiled_preference_rule jsonb not null, -- { key, value, weight }
  applied_at timestamptz not null default now()
);
create index if not exists truckeros_memories_driver_idx on truckeros_memories(driver_id);

create table if not exists truckeros_audit_events (
  id text primary key,
  actor_type text not null check (actor_type in ('driver', 'system', 'api_gateway')),
  actor_id text not null,
  event_name text not null,
  payload jsonb not null default '{}'::jsonb,
  triggered_by text not null,
  driver_approved boolean, -- null when not applicable to this event
  occurred_at timestamptz not null default now()
);
create index if not exists truckeros_audit_events_time_idx on truckeros_audit_events(occurred_at desc);
create index if not exists truckeros_audit_events_actor_idx on truckeros_audit_events(actor_type, actor_id);

insert into truckeros_place_categories (slug, name) values
  ('food', 'Food'),
  ('bbq', 'BBQ'),
  ('nightlife', 'Nightlife / Bars'),
  ('live_music', 'Live Music'),
  ('comedy', 'Comedy'),
  ('attractions', 'Attractions'),
  ('shopping', 'Shopping'),
  ('outdoors', 'Parks / Outdoors'),
  ('gyms', 'Gyms'),
  ('movie_theaters', 'Movie Theaters'),
  ('coffee', 'Coffee'),
  ('truck_stops', 'Truck Stops'),
  ('showers', 'Showers'),
  ('laundromats', 'Laundromats')
on conflict (slug) do nothing;
