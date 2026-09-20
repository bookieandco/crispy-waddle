-- Preserve the originating reasoning-event lineage when a PENDING memory
-- candidate is explicitly approved into jhadina_memories.
--
-- This is nullable for backwards compatibility with existing approved memories
-- and manually-created test fixtures. New approvals populate it from the
-- candidate's already-governed reasoning_event_id.
alter table public.jhadina_memories
  add column if not exists reasoning_event_id text;

create index if not exists jhadina_memories_reasoning_event_idx
  on public.jhadina_memories (reasoning_event_id)
  where reasoning_event_id is not null;
