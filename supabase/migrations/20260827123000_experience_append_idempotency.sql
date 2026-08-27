-- Experience append/idempotency hardening.
-- The event id is the immutable idempotency key. A repeated append of the
-- same id must not create a second row; a conflicting payload must be rejected
-- by the application adapter rather than silently overwriting history.

create unique index if not exists jhadina_experience_events_id_uidx
  on public.jhadina_experience_events (id);

create index if not exists jhadina_experience_events_scope_recorded_idx
  on public.jhadina_experience_events (user_id, recorded_at desc);

comment on column public.jhadina_experience_events.id is
  'Immutable application event/idempotency key. Re-appending the same event id is idempotent; conflicting payloads must not overwrite history.';
