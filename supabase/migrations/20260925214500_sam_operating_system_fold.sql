alter table public.jhadina_sam_analysis
  add column if not exists operating jsonb not null default '{}'::jsonb;

comment on column public.jhadina_sam_analysis.operating is
  'Evidence-governed SAM operating context (capture/readiness intelligence only; grants no outreach, submission, execution, borrowing, or payment authority).';


alter table public.jhadina_sam_pursuit_options
  add column if not exists provider_bench jsonb not null default '[]'::jsonb,
  add column if not exists contract_execution_authorized boolean not null default false;

alter table public.jhadina_sam_pursuit_options
  drop constraint if exists jhadina_sam_pursuit_options_contract_execution_authorized_check;

alter table public.jhadina_sam_pursuit_options
  add constraint jhadina_sam_pursuit_options_contract_execution_authorized_check
  check (contract_execution_authorized = false);

comment on column public.jhadina_sam_pursuit_options.provider_bench is
  'Per-requirement provider sourcing coverage; intelligence only and not provider-selection authority.';
