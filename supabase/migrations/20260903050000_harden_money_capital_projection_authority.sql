-- Money Core authority hardening.
--
-- These projection tables are financial state. They must not be directly
-- writable by browser roles, and the SECURITY DEFINER projection writer must
-- not be callable by browser roles. Legitimate server-side Money Core work
-- uses service_role until a narrower caller-bound RPC is introduced.

revoke all on table
  public.jhadina_capital_transaction_projection,
  public.jhadina_capital_position_projection,
  public.jhadina_capital_lot_projection
from public;

revoke all on table
  public.jhadina_capital_transaction_projection,
  public.jhadina_capital_position_projection,
  public.jhadina_capital_lot_projection
from anon, authenticated;

grant select, insert, update, delete, truncate, trigger, references on table
  public.jhadina_capital_transaction_projection,
  public.jhadina_capital_position_projection,
  public.jhadina_capital_lot_projection
to service_role;

alter table public.jhadina_capital_transaction_projection enable row level security;
alter table public.jhadina_capital_position_projection enable row level security;
alter table public.jhadina_capital_lot_projection enable row level security;

revoke all on function public.write_capital_projection_atomic(jsonb, jsonb, jsonb) from public;
revoke all on function public.write_capital_projection_atomic(jsonb, jsonb, jsonb) from anon, authenticated;
grant execute on function public.write_capital_projection_atomic(jsonb, jsonb, jsonb) to service_role;

-- Keep the existing SECURITY DEFINER implementation server-only. A future
-- Money Core repair must replace its caller-controlled financial fields with
-- authenticated/capability-bound inputs before browser-role execution is
-- ever reconsidered.
