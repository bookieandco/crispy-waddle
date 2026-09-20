-- K-1.4.9 crypto resolution and live-signature cleanup.
-- pgcrypto functions live in the extensions schema on Supabase.

drop function if exists public.jhadina_create_revalidation_trigger(
  uuid,text,text,uuid,jsonb,text,integer,integer,jsonb,text
);

alter function public.jhadina_create_revalidation_trigger(
  uuid,uuid,text,text,jsonb,text,integer,integer,jsonb,text
) set search_path=public,pg_catalog,extensions;

alter function public.jhadina_compile_research_plan(
  uuid,text,jsonb,jsonb,text,integer,integer,jsonb
) set search_path=public,pg_catalog,extensions;

alter function public.jhadina_claim_research_execution(
  uuid,uuid,text,integer
) set search_path=public,pg_catalog,extensions;

alter function public.jhadina_reserve_research_provider_submission(
  uuid,uuid,text,text,text,text,text,text
) set search_path=public,pg_catalog,extensions;

alter function public.jhadina_create_knowledge_candidate(
  uuid,uuid,text,text,text,jsonb,numeric,uuid[],numeric,integer,boolean,timestamptz
) set search_path=public,pg_catalog,extensions;
