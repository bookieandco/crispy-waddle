-- GEV production hardening: pin append-only trigger function search_path.
-- This removes role-mutable search path ambiguity without changing trigger behavior.

alter function public.reject_jhadina_spatial_evidence_mutation()
  set search_path = pg_catalog;

alter function public.jhadina_spatial_reality_append_only()
  set search_path = pg_catalog;

alter function public.jhadina_spatial_workspace_append_only()
  set search_path = pg_catalog;

alter function public.jhadina_knowledge_graph_append_only()
  set search_path = pg_catalog;
