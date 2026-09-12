-- REGRET-012: preserve append-only history while allowing governed supersession lineage.
-- Historical regret fields remain immutable; the only permitted update is setting
-- superseded_by once from NULL to a replacement memory in the same record.

create or replace function public.jhadina_regret_memory_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'jhadina_regret_memory is append-only';
  end if;

  if tg_op = 'UPDATE' then
    if old.memory_id is distinct from new.memory_id
      or old.user_id is distinct from new.user_id
      or old.regret is distinct from new.regret
      or old.created_at is distinct from new.created_at
      or old.provenance is distinct from new.provenance
      or old.tags is distinct from new.tags
      or old.salience is distinct from new.salience
      or old.supersedes is distinct from new.supersedes
      or old.superseded_by is not null
      or new.superseded_by is null then
      raise exception 'jhadina_regret_memory historical fields are immutable';
    end if;
    return new;
  end if;

  raise exception 'jhadina_regret_memory mutation is not permitted';
end;
$$;
