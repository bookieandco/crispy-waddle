-- Disposable PostgreSQL fixture ONLY. Never point at production Supabase.
-- Precondition: postgres superuser on a throwaway CI service.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create table auth.users (id uuid primary key);
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
create function auth.uid() returns uuid language sql stable as $fn$
 select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$fn$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
