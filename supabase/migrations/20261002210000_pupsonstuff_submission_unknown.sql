-- SH-POD-LIVE: represent uncertain Printify submission outcomes explicitly.
-- A network/provider ambiguity must never be converted into a blind retry that
-- could create a duplicate physical order.

alter table public.pupson_fulfillment_orders
  drop constraint if exists pupson_fulfillment_orders_status_check;

alter table public.pupson_fulfillment_orders
  add constraint pupson_fulfillment_orders_status_check
  check (status in (
    'pending',
    'submitting',
    'submission_unknown',
    'submitted',
    'in_production',
    'shipped',
    'fulfilled',
    'blocked',
    'failed',
    'cancelled'
  ));

comment on column public.pupson_fulfillment_orders.status is
  'Fulfillment lifecycle. submission_unknown is fail-closed: reconcile provider state before any resubmission.';
