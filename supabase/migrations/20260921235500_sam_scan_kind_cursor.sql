alter table public.jhadina_sam_scan_runs
  add column if not exists scan_kind text not null default 'recent'
  check (scan_kind in ('recent','backfill','manual'));

create index if not exists jhadina_sam_scan_runs_kind_id_idx
  on public.jhadina_sam_scan_runs(scan_kind, id desc);
