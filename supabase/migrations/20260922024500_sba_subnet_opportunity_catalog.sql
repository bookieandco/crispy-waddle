create table if not exists public.jhadina_subnet_scan_runs (
  id uuid primary key,
  status text not null check (status in ('running','completed','failed')),
  pages_fetched integer not null default 0 check (pages_fetched >= 0),
  records_seen integer not null default 0 check (records_seen >= 0),
  truncated boolean not null default false,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.jhadina_subnet_catalog (
  external_id text primary key,
  title text not null,
  prime_name text not null,
  description text,
  closing_date date,
  performance_start_date date,
  place_of_performance text,
  naics_code text,
  naics_label text,
  contact_name text,
  contact_email text,
  contact_phone text,
  source_url text not null check (source_url like 'https://legacy.sba.gov/%'),
  source_page integer not null default 0 check (source_page >= 0),
  raw jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jhadina_subnet_catalog_closing_idx on public.jhadina_subnet_catalog(closing_date);
create index if not exists jhadina_subnet_catalog_naics_idx on public.jhadina_subnet_catalog(naics_code);
create index if not exists jhadina_subnet_catalog_prime_idx on public.jhadina_subnet_catalog(prime_name);
create index if not exists jhadina_subnet_scan_runs_started_idx on public.jhadina_subnet_scan_runs(started_at desc);

alter table public.jhadina_subnet_catalog enable row level security;
alter table public.jhadina_subnet_scan_runs enable row level security;

revoke all on table public.jhadina_subnet_catalog from anon, authenticated;
revoke all on table public.jhadina_subnet_scan_runs from anon, authenticated;
grant select,insert,update,delete on table public.jhadina_subnet_catalog to service_role;
grant select,insert,update,delete on table public.jhadina_subnet_scan_runs to service_role;
