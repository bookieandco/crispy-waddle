create table if not exists public.oce_in_app_notifications (
  id uuid primary key default gen_random_uuid(),
  delivery_id text not null,
  alert_id text not null,
  recipient_id uuid not null,
  priority text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists oce_in_app_notifications_delivery_uidx
  on public.oce_in_app_notifications (delivery_id);

create index if not exists oce_in_app_notifications_recipient_unread_idx
  on public.oce_in_app_notifications (recipient_id, created_at desc)
  where read_at is null;

alter table public.oce_in_app_notifications enable row level security;

revoke all on table public.oce_in_app_notifications from public, anon, authenticated;
grant select, insert, update on table public.oce_in_app_notifications to service_role;

alter table public.oce_in_app_notifications
  drop constraint if exists oce_in_app_notifications_delivery_fk;
alter table public.oce_in_app_notifications
  add constraint oce_in_app_notifications_delivery_fk
  foreign key (delivery_id) references public.oce_alert_deliveries(id) on delete cascade;

alter table public.oce_in_app_notifications
  drop constraint if exists oce_in_app_notifications_alert_fk;
alter table public.oce_in_app_notifications
  add constraint oce_in_app_notifications_alert_fk
  foreign key (alert_id) references public.oce_alert_events(id) on delete cascade;
