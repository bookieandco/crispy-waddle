-- MONEY-FINAL credential split: authorization metadata may be owner-readable;
-- encrypted provider credentials live in a service-role-only table.
create table if not exists public.jhadina_money_bank_credentials (
  connection_id uuid primary key references public.jhadina_money_bank_connections(id) on delete cascade,
  encrypted_access_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.jhadina_money_bank_credentials enable row level security;
revoke all on public.jhadina_money_bank_credentials from public, anon, authenticated;
create policy "money bank credentials service role only" on public.jhadina_money_bank_credentials for all to service_role using (true) with check (true);

insert into public.jhadina_money_bank_credentials(connection_id,encrypted_access_token)
select id,encrypted_access_token from public.jhadina_money_bank_connections
where encrypted_access_token is not null
on conflict(connection_id) do update set encrypted_access_token=excluded.encrypted_access_token,updated_at=now();

alter table public.jhadina_money_bank_connections drop column if exists encrypted_access_token;

-- Owner-readable authorization metadata contains no provider secret.
grant select on public.jhadina_money_bank_connections to authenticated;
grant select on public.jhadina_money_bank_accounts to authenticated;
revoke insert,update,delete on public.jhadina_money_bank_connections from authenticated;
revoke insert,update,delete on public.jhadina_money_bank_accounts from authenticated;

create or replace function public.jhadina_money_owned_account_ids()
returns table(provider_account_id text)
language sql
security invoker
set search_path=public
as $$
  select a.provider_account_id
  from public.jhadina_money_bank_accounts a
  join public.jhadina_money_bank_connections c on c.id=a.connection_id and c.user_id=a.user_id
  where a.user_id=auth.uid() and a.status='active' and c.status='active';
$$;
revoke all on function public.jhadina_money_owned_account_ids() from public,anon;
grant execute on function public.jhadina_money_owned_account_ids() to authenticated;
