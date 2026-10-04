-- Compatibility bootstrap for replaying Supabase-oriented migrations on
-- plain PostgreSQL during portable staging/Homebase certification.
--
-- These roles are database roles only. They do not recreate Supabase Auth,
-- PostgREST, Storage, Edge Functions, or any external control plane.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $
BEGIN
  -- Official postgres images omit the literal postgres role when POSTGRES_USER
  -- is customized. Historical Money migrations grant selected functions to
  -- that role, so create a non-login compatibility principal when absent.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    CREATE ROLE postgres NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
$$;

-- Portable services connect with their own login role. Grant membership in the
-- service_role capability role rather than handing browser/client code a
-- database superuser credential.
DO $$
DECLARE
  current_login text := current_user;
BEGIN
  IF current_login <> 'service_role' THEN
    EXECUTE format('GRANT service_role TO %I', current_login);
  END IF;
END
$$;
