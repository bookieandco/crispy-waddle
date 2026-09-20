-- DIR-11 append-only media review evidence and decisions.
create table if not exists public.director_media_quality_evidence (
 id text primary key, project_id text not null, artifact_id text not null, kind text not null check(kind in ('image','video')),
 status text not null check(status in ('pass','warn','fail')), score double precision, checked_at timestamptz not null,
 checker text not null, metrics jsonb not null default '{}', provenance jsonb, asset_sha256 text, notes text[] not null default '{}'
);
create table if not exists public.director_media_review_decisions (
 id text primary key, project_id text not null, run_id text not null references public.director_production_runs(id) on delete restrict,
 gate_id text not null references public.director_creative_gates(id) on delete restrict, generation_stage_id text not null,
 generation_stage_version bigint not null, review_stage_id text not null, review_stage_version bigint not null,
 asset_id text not null, generation_job_id text not null, decision text not null check(decision in ('approved','changes_requested','rejected')),
 note text, evidence_ids text[] not null default '{}', decided_by text not null, decided_at timestamptz not null default now(),
 provenance jsonb not null, unique(project_id,run_id,review_stage_id,review_stage_version,asset_id)
);
create index if not exists director_review_asset_idx on public.director_media_review_decisions(project_id,asset_id);
alter table public.director_media_quality_evidence enable row level security;
alter table public.director_media_review_decisions enable row level security;
revoke all on public.director_media_quality_evidence from anon, authenticated;
revoke all on public.director_media_review_decisions from anon, authenticated;
grant select,insert on public.director_media_quality_evidence to service_role;
grant select,insert on public.director_media_review_decisions to service_role;
create or replace function public.reject_director_review_mutation() returns trigger language plpgsql as $$ begin raise exception 'director review evidence is append-only'; end $$;
drop trigger if exists director_review_decision_immutable on public.director_media_review_decisions;
create trigger director_review_decision_immutable before update or delete on public.director_media_review_decisions for each row execute function public.reject_director_review_mutation();
