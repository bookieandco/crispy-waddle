-- MEME-VENTURE.RUNTIME.01–.03
-- Owner-scoped design drafts ONLY. Never grants issuance, signing, trading,
-- marketing, spending, experiment admission or commercial outcome.
-- Migration must be applied only to Jhadina's verified project. Do not
-- commission in an unrelated PupsonStuff / Swlc Supabase project.

create table if not exists public.jhadina_meme_studio_drafts (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  draft_id uuid not null default gen_random_uuid(),
  candidate_id text not null default 'venture:token-launch-services-2026-10-15'
    check (candidate_id = 'venture:token-launch-services-2026-10-15'),
  venture_id text null,
  revision integer not null default 1 check (revision between 1 and 1000001),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  authority text not null default 'PAPER_ONLY' check (authority = 'PAPER_ONLY'),
  external_action_authorized boolean not null default false check (external_action_authorized = false),
  money_movement_authorized boolean not null default false check (money_movement_authorized = false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  primary key (owner_user_id, draft_id),
  constraint jhadina_meme_studio_payload_shape check (
    (payload ?& array['draft','tier','laborHours','laborRate','otherCosts','paperSol','paperBuySol','paperSellTokens'])
    and jsonb_typeof(payload->'draft') = 'object'
  )
);

create index if not exists jhadina_meme_studio_owner_updated
  on public.jhadina_meme_studio_drafts (owner_user_id, updated_at desc)
  where archived_at is null;

alter table public.jhadina_meme_studio_drafts enable row level security;
alter table public.jhadina_meme_studio_drafts force row level security;

-- Only the Jhadina server's separately verified and owner-filtered
-- service boundary can read/write these records. Never expose table access
-- directly to browser anon/authenticated keys or create broad RLS bypasses.
revoke all on public.jhadina_meme_studio_drafts from public, anon, authenticated;
revoke all on public.jhadina_meme_studio_drafts from service_role;
grant select, insert, update on public.jhadina_meme_studio_drafts to service_role;

comment on table public.jhadina_meme_studio_drafts is
  'Paper-only, owner-scoped token-brand concept drafts; links only after Venture Factory adoption. Not an issuance, wallet, financial receipt, legal clearance, approval or evidence source.';
