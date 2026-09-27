alter table public.jhadina_sam_scan_runs
  add column if not exists source_kind text not null default 'api',
  add column if not exists source_url text,
  add column if not exists source_sha256 text,
  add column if not exists source_bytes bigint,
  add column if not exists source_rows integer,
  add column if not exists source_snapshot_at timestamptz;

alter table public.jhadina_sam_scan_runs
  drop constraint if exists jhadina_sam_scan_runs_source_kind_check;

alter table public.jhadina_sam_scan_runs
  add constraint jhadina_sam_scan_runs_source_kind_check
  check (source_kind in ('api','bulk_snapshot'));

comment on column public.jhadina_sam_scan_runs.source_kind is
  'Authoritative acquisition source used for this scan receipt: paginated SAM API or fully-consumed public bulk snapshot.';
comment on column public.jhadina_sam_scan_runs.source_sha256 is
  'SHA-256 of the complete raw bulk snapshot bytes when source_kind=bulk_snapshot.';
comment on column public.jhadina_sam_scan_runs.source_snapshot_at is
  'Observed source snapshot timestamp (for example HTTP Last-Modified) used to bound coverage without inventing same-day completeness.';
