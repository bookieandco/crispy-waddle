-- OCE 6.75 durable in-app notification provider surface.
-- Notifications are created by the server-side delivery worker and are
-- idempotent per delivery. Client access is intentionally policy-gated.

create table if not exists public.oce_in_app_notifications (
  id text primary key,
  delivery_id text not null unique references public.oce_alert_deliveries(id),
  alert_id text not null references public.oce_alert_events(id),
  recipient_id uuid not null references auth.users(id),
  priority text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists oce_in_app_notifications_recipient_created_idx
  on public.oce_in_app_notifications (recipient_id, created_at desc);

create index if not exists oce_in_app_notifications_recipient_unread_idx
  on public.oce_in_app_notifications (recipient_id, created_at desc)
  where read_at is null;

alter table public.oce_in_app_notifications enable row level security;

-- The initial provider writes through the service-role/server boundary.
-- Client read/mark-read policies will be added with the authenticated UI surface.
revoke all on table public.oce_in_app_notifications from anon, authenticated;
grant select, insert, update, delete on table public.oce_in_app_notifications to service_role;
