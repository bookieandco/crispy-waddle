create table if not exists public.jhadina_safety_consumer_setups (
  owner_id text primary key,
  enrollment_id text not null,
  product_version text not null check (product_version = 'CONSUMER-SAFETYOS.v1'),
  stage text not null check (stage in ('setup','drill-required','live-admission-required','live-admitted')),
  blockers jsonb not null default '[]'::jsonb check (jsonb_typeof(blockers) = 'array'),
  updated_at timestamptz not null,
  constraint jhadina_safety_consumer_setups_owner_nonempty check (char_length(trim(owner_id)) > 0),
  constraint jhadina_safety_consumer_setups_enrollment_nonempty check (char_length(trim(enrollment_id)) > 0)
);

alter table public.jhadina_safety_consumer_setups enable row level security;

revoke all on table public.jhadina_safety_consumer_setups from anon, authenticated;

comment on table public.jhadina_safety_consumer_setups is
  'Non-secret Consumer SafetyOS onboarding/readiness state only. Plaintext code words, contact details, confirmation phrases, encryption keys, and evidence payloads are forbidden.';
