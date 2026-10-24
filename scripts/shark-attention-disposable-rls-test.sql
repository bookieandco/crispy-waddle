-- Run after the owner-alert migration on a disposable PostgreSQL server.
-- No external Supabase credentials, paid resources or production tables.
insert into public.shark_attention_owner_alerts
 (owner_id,alert_id,mint,code,severity,source_url,observed_at)
values
 ('11111111-1111-4111-8111-111111111111','a','So11111111111111111111111111111111111111112','PRICE_SWING','WATCH','https://dexscreener.com/solana/11111111111111111111111111111112',now()),
 ('22222222-2222-4222-8222-222222222222','b','So11111111111111111111111111111111111111112','LIQUIDITY_RISK','HIGH','https://dexscreener.com/solana/11111111111111111111111111111112',now());
do $verify$
begin
 if not (select relrowsecurity from pg_class where oid='public.shark_attention_owner_alerts'::regclass)
   then raise exception 'RLS_NOT_ENABLED'; end if;
 if not has_table_privilege('authenticated','public.shark_attention_owner_alerts','SELECT')
    or has_table_privilege('authenticated','public.shark_attention_owner_alerts','INSERT')
    or has_table_privilege('authenticated','public.shark_attention_owner_alerts','UPDATE')
    or has_table_privilege('authenticated','public.shark_attention_owner_alerts','DELETE')
    or has_table_privilege('anon','public.shark_attention_owner_alerts','SELECT')
   then raise exception 'RLS_GRANTS_INVALID'; end if;
end $verify$;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $verify$
begin
  if (select count(*) from public.shark_attention_owner_alerts)<>1 then
    raise exception 'OWNER_A_ROW_ISOLATION_FAILED'; end if;
  if (select min(alert_id) from public.shark_attention_owner_alerts)<>'a' then
    raise exception 'OWNER_A_WRONG_ROW'; end if;
  begin
    insert into public.shark_attention_owner_alerts
      (owner_id,alert_id,mint,code,severity,source_url,observed_at)
    values ('11111111-1111-4111-8111-111111111111','forbidden',
      'So11111111111111111111111111111111111111112','PRICE_SWING','WATCH',
      'https://dexscreener.com/solana/11111111111111111111111111111112',now());
    raise exception 'OWNER_CLIENT_INSERT_UNEXPECTEDLY_SUCCEEDED';
  exception when insufficient_privilege then null;
  end;
end $verify$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $verify$
begin
  if (select count(*) from public.shark_attention_owner_alerts)<>1 then
    raise exception 'OWNER_B_ROW_ISOLATION_FAILED'; end if;
  if (select min(alert_id) from public.shark_attention_owner_alerts)<>'b' then
    raise exception 'OWNER_B_WRONG_ROW'; end if;
end $verify$;
select set_config('request.jwt.claim.sub','',false);
do $verify$
begin
  if (select count(*) from public.shark_attention_owner_alerts)<>0 then
    raise exception 'NO_USER_SEES_ROWS'; end if;
end $verify$;
reset role;
