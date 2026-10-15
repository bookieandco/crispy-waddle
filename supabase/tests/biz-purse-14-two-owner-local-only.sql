-- BIZ-PURSE.14: DISPOSABLE POSTGRES ONLY.
-- Run using scripts/biz-purse-14-local-owner-test.mjs AFTER canonical
-- migrations and Supabase auth schema are loaded on a LOCAL throwaway DB.
-- The entire fixture is transactional and rolled back on success.
begin;
do $guard$
begin
  if current_database() !~ '^biz_purse_recovery_[a-z0-9_]+$' then
    raise exception 'BIZ_PURSE_DISPOSABLE_DATABASE_REQUIRED';
  end if;
  if to_regclass('public.jhadina_side_hustle_work_orders') is null or
     to_regclass('public.jhadina_opportunities') is null then
    raise exception 'BIZ_PURSE_CANONICAL_MIGRATIONS_NOT_LOADED';
  end if;
end
$guard$;

-- These fixed UUIDs are disposable test fixtures. Never real users.
insert into auth.users
  (instance_id,id,aud,role,email,encrypted_password,created_at,updated_at)
values
  ('00000000-0000-0000-0000-000000000000','5d2e16f6-0b2c-4aae-9782-93aa10000001','authenticated','authenticated','biz-purse-owner-a@example.invalid','','2026-10-14T22:00:00Z','2026-10-14T22:00:00Z'),
  ('00000000-0000-0000-0000-000000000000','5d2e16f6-0b2c-4aae-9782-93aa10000002','authenticated','authenticated','biz-purse-owner-b@example.invalid','','2026-10-14T22:00:00Z','2026-10-14T22:00:00Z');

insert into public.jhadina_opportunities
 (user_id,id,family,opportunity_type,status,source_name,source_url,payload,created_at,updated_at)
values
 ('5d2e16f6-0b2c-4aae-9782-93aa10000001','biz-purse-14-owner-a','business_automation','commercial','approved','local test','https://example.invalid/a','{}','2026-10-14T22:00:00Z','2026-10-14T22:00:00Z'),
 ('5d2e16f6-0b2c-4aae-9782-93aa10000002','biz-purse-14-owner-b','business_automation','commercial','approved','local test','https://example.invalid/b','{}','2026-10-14T22:00:00Z','2026-10-14T22:00:00Z');

insert into public.jhadina_side_hustle_work_orders
 (user_id,id,opportunity_id,family,customer_ref,status,amount,currency,payload,created_at,updated_at)
values
 ('5d2e16f6-0b2c-4aae-9782-93aa10000001','biz-purse-14-order-a','biz-purse-14-owner-a','business_automation','customer-a','draft',99,'USD','{}','2026-10-14T22:00:00Z','2026-10-14T22:00:00Z'),
 ('5d2e16f6-0b2c-4aae-9782-93aa10000002','biz-purse-14-order-b','biz-purse-14-owner-b','business_automation','customer-b','draft',99,'USD','{}','2026-10-14T22:00:00Z','2026-10-14T22:00:00Z');

-- Verify both authenticated owners can SELECT their own row, but never
-- another owner's row. Bypass/service grants do not count as RLS proof.
set local role authenticated;
select set_config('request.jwt.claim.sub','5d2e16f6-0b2c-4aae-9782-93aa10000001',true);
do $owner_a$
begin
 if auth.uid() <> '5d2e16f6-0b2c-4aae-9782-93aa10000001'::uuid then
  raise exception 'BIZ_PURSE_OWNER_A_AUTH_MISMATCH';
 end if;
 if (select count(*) from public.jhadina_side_hustle_work_orders) <> 1 or
    (select count(*) from public.jhadina_side_hustle_work_orders where id='biz-purse-14-order-a') <> 1 or
    (select count(*) from public.jhadina_side_hustle_work_orders where id='biz-purse-14-order-b') <> 0 then
  raise exception 'BIZ_PURSE_OWNER_A_ROW_ISOLATION_FAILURE';
 end if;
 if has_table_privilege('authenticated','public.jhadina_side_hustle_work_orders','INSERT') or
    has_table_privilege('authenticated','public.jhadina_side_hustle_work_orders','UPDATE') then
  raise exception 'BIZ_PURSE_UNEXPECTED_DIRECT_CLIENT_WRITE';
 end if;
end
$owner_a$;

select set_config('request.jwt.claim.sub','5d2e16f6-0b2c-4aae-9782-93aa10000002',true);
do $owner_b$
begin
 if auth.uid() <> '5d2e16f6-0b2c-4aae-9782-93aa10000002'::uuid then
  raise exception 'BIZ_PURSE_OWNER_B_AUTH_MISMATCH';
 end if;
 if (select count(*) from public.jhadina_side_hustle_work_orders) <> 1 or
    (select count(*) from public.jhadina_side_hustle_work_orders where id='biz-purse-14-order-b') <> 1 or
    (select count(*) from public.jhadina_side_hustle_work_orders where id='biz-purse-14-order-a') <> 0 then
  raise exception 'BIZ_PURSE_OWNER_B_ROW_ISOLATION_FAILURE';
 end if;
end
$owner_b$;
reset role;

-- Nothing in this file persists the fixtures.
rollback;
