create table if not exists public.jhadina_sam_pursuit_options (
  notice_id text primary key references public.jhadina_sam_catalog(notice_id) on delete cascade,
  status text not null check (status in ('ready_for_quote','review_required','blocked')),
  assignments jsonb not null default '[]'::jsonb,
  covered_requirement_ids text[] not null default '{}',
  uncovered_requirement_ids text[] not null default '{}',
  quote_targets jsonb not null default '[]'::jsonb,
  commercial jsonb not null default '{}'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  human_approval_required boolean not null default true check (human_approval_required = true),
  outreach_authorized boolean not null default false check (outreach_authorized = false),
  bid_submission_authorized boolean not null default false check (bid_submission_authorized = false),
  payment_authorized boolean not null default false check (payment_authorized = false),
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jhadina_sam_pursuit_options_status_idx
  on public.jhadina_sam_pursuit_options(status, generated_at desc);

alter table public.jhadina_sam_pursuit_options enable row level security;

revoke all on table public.jhadina_sam_pursuit_options from anon, authenticated;
grant select, insert, update, delete on table public.jhadina_sam_pursuit_options to service_role;
