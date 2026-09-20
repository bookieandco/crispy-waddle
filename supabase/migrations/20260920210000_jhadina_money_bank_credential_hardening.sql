-- MONEY-FINAL hardening: bank credentials are server-only.
-- Authenticated clients retain only the narrow owned-account-id RPC.
revoke all on public.jhadina_money_bank_connections from authenticated, anon;
revoke all on public.jhadina_money_bank_accounts from authenticated, anon;

-- Browser/session clients may resolve only their active account ids. The
-- function owns the table read but binds it to auth.uid() and exposes no
-- Item id, credential reference, or encrypted access token.
create or replace function public.jhadina_money_owned_account_ids()
returns table(provider_account_id text)
language sql
security definer
set search_path=public
as $$
  select a.provider_account_id
  from public.jhadina_money_bank_accounts a
  join public.jhadina_money_bank_connections c
    on c.id=a.connection_id and c.user_id=a.user_id
  where auth.uid() is not null
    and a.user_id=auth.uid()
    and a.status='active'
    and c.status='active';
$$;
revoke all on function public.jhadina_money_owned_account_ids() from public, anon;
grant execute on function public.jhadina_money_owned_account_ids() to authenticated;

-- Connection mutation is a server-only lifecycle. These legacy RPCs remain
-- defined for migration compatibility but are not callable by browser roles.
revoke all on function public.jhadina_money_upsert_bank_connection(text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.jhadina_money_disconnect_bank_connection(uuid) from public, anon, authenticated;
