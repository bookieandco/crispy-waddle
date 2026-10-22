-- JH-PURSE-SQL-REPLAY: disposable CI PostgreSQL only; never production.
-- Uses two synthetic tenant IDs and tests the actual canonical RLS policy.
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

INSERT INTO auth.users(id) VALUES
 ('22222222-2222-4222-8222-222222222222')
ON CONFLICT DO NOTHING;

INSERT INTO public.jhadina_opportunities (
 user_id,id,family,opportunity_type,status,payload
) VALUES
 ('11111111-1111-4111-8111-111111111111','opportunity:rls-owner',
  'business','commercial','ready','{}'::jsonb),
 ('22222222-2222-4222-8222-222222222222','opportunity:rls-other',
  'business','commercial','ready','{}'::jsonb)
ON CONFLICT (user_id,id) DO NOTHING;

INSERT INTO public.jhadina_side_hustle_work_orders(
 user_id,id,opportunity_id,family,customer_ref,status,amount,currency,
 payload,created_at,updated_at
) VALUES
 ('11111111-1111-4111-8111-111111111111','work-order:rls-owner',
  'opportunity:rls-owner','content_social','customer:fixture','draft',
  99,'USD','{}'::jsonb,now(),now()),
 ('22222222-2222-4222-8222-222222222222','work-order:rls-other',
  'opportunity:rls-other','content_social','customer:fixture','draft',
  99,'USD','{}'::jsonb,now(),now())
ON CONFLICT (user_id,id) DO NOTHING;

-- Never expose the table or SECURITY DEFINER RPC to anonymous callers.
DO $check$
BEGIN
 IF has_table_privilege('anon',
   'public.jhadina_side_hustle_work_orders','SELECT') THEN
   RAISE EXCEPTION 'Purse CI: anon can SELECT owner work orders';
 END IF;
 IF has_function_privilege('anon',
   'public.jhadina_side_hustle_work_order_save(jsonb)','EXECUTE') THEN
   RAISE EXCEPTION 'Purse CI: anon can EXECUTE owner RPC';
 END IF;
END
$check$;

SET ROLE authenticated;
SET app.user_id = '11111111-1111-4111-8111-111111111111';
DO $check$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.jhadina_side_hustle_work_orders
                WHERE id='work-order:rls-owner') THEN
   RAISE EXCEPTION 'Purse CI: owner cannot SELECT own work order';
 END IF;
 IF EXISTS (SELECT 1 FROM public.jhadina_side_hustle_work_orders
            WHERE id='work-order:rls-other') THEN
   RAISE EXCEPTION 'Purse CI: owner A saw owner B work order';
 END IF;
END
$check$;

SET app.user_id = '22222222-2222-4222-8222-222222222222';
DO $check$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.jhadina_side_hustle_work_orders
                WHERE id='work-order:rls-other') THEN
   RAISE EXCEPTION 'Purse CI: owner B cannot SELECT own work order';
 END IF;
 IF EXISTS (SELECT 1 FROM public.jhadina_side_hustle_work_orders
            WHERE id='work-order:rls-owner') THEN
   RAISE EXCEPTION 'Purse CI: owner B saw owner A work order';
 END IF;
END
$check$;
RESET ROLE;
