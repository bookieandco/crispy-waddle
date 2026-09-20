-- MONEY read-spine: durable per-user Plaid Item/account ownership.
-- Access tokens are deliberately NOT stored here. This table is authorization metadata only.
create table if not exists public.jhadina_money_bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider = 'plaid'),
  provider_item_id text not null,
  credential_ref text not null,
  encrypted_access_token text not null,
  institution_name text,
  status text not null default 'active' check (status in ('active','revoked','disconnected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, provider_item_id)
);

create table if not exists public.jhadina_money_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.jhadina_money_bank_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_account_id text not null,
  status text not null default 'active' check (status in ('active','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider_account_id)
);
create index if not exists jhadina_money_bank_connections_user_idx on public.jhadina_money_bank_connections(user_id,status);
create index if not exists jhadina_money_bank_accounts_user_idx on public.jhadina_money_bank_accounts(user_id,status);
alter table public.jhadina_money_bank_connections enable row level security;
alter table public.jhadina_money_bank_accounts enable row level security;
create policy "money bank connections are owner readable" on public.jhadina_money_bank_connections for select to authenticated using ((select auth.uid()) = user_id);
create policy "money bank accounts are owner readable" on public.jhadina_money_bank_accounts for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.jhadina_money_bank_connections from authenticated;
revoke insert, update, delete on public.jhadina_money_bank_accounts from authenticated;
grant select on public.jhadina_money_bank_connections to authenticated;
grant select on public.jhadina_money_bank_accounts to authenticated;

create or replace function public.jhadina_money_owned_account_ids()
returns table(provider_account_id text)
language sql security invoker set search_path=public
as $$ select a.provider_account_id from public.jhadina_money_bank_accounts a join public.jhadina_money_bank_connections c on c.id=a.connection_id and c.user_id=a.user_id where a.user_id=auth.uid() and a.status='active' and c.status='active'; $$;


create or replace function public.jhadina_money_upsert_bank_connection(p_provider_item_id text,p_credential_ref text,p_encrypted_access_token text,p_accounts jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_connection uuid; v_account jsonb;
begin
 if v_user is null then raise exception 'authentication required'; end if;
 if p_provider_item_id='' or p_credential_ref='' or p_encrypted_access_token='' then raise exception 'invalid bank connection'; end if;
 insert into public.jhadina_money_bank_connections(user_id,provider,provider_item_id,credential_ref,encrypted_access_token,status)
 values(v_user,'plaid',p_provider_item_id,p_credential_ref,p_encrypted_access_token,'active')
 on conflict(user_id,provider,provider_item_id) do update set credential_ref=excluded.credential_ref,encrypted_access_token=excluded.encrypted_access_token,status='active',updated_at=now()
 returning id into v_connection;
 update public.jhadina_money_bank_accounts set status='removed',updated_at=now() where user_id=v_user and connection_id=v_connection;
 for v_account in select * from jsonb_array_elements(coalesce(p_accounts,'[]'::jsonb)) loop
   insert into public.jhadina_money_bank_accounts(connection_id,user_id,provider_account_id,status)
   values(v_connection,v_user,v_account->>'account_id','active')
   on conflict(user_id,provider_account_id) do update set connection_id=excluded.connection_id,status='active',updated_at=now();
 end loop;
 return v_connection;
end $$;
revoke all on function public.jhadina_money_upsert_bank_connection(text,text,text,jsonb) from public;
grant execute on function public.jhadina_money_upsert_bank_connection(text,text,text,jsonb) to authenticated;

create or replace function public.jhadina_money_disconnect_bank_connection(p_connection_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 update public.jhadina_money_bank_connections set status='disconnected',updated_at=now() where id=p_connection_id and user_id=auth.uid();
 update public.jhadina_money_bank_accounts set status='removed',updated_at=now() where connection_id=p_connection_id and user_id=auth.uid();
end $$;
revoke all on function public.jhadina_money_disconnect_bank_connection(uuid) from public;
grant execute on function public.jhadina_money_disconnect_bank_connection(uuid) to authenticated;

grant execute on function public.jhadina_money_owned_account_ids() to authenticated;
