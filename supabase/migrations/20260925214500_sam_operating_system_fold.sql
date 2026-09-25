alter table public.jhadina_sam_analysis
  add column if not exists operating jsonb not null default '{}'::jsonb;

comment on column public.jhadina_sam_analysis.operating is
  'Evidence-governed SAM operating context (capture/readiness intelligence only; grants no outreach, submission, execution, borrowing, or payment authority).';
