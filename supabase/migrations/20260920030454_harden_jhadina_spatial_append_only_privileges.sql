-- GEV production hardening: append-only tables must not be mutable through service_role.
-- Row triggers do not fire on TRUNCATE, so table privileges are reduced to the
-- only operations the spatial runtime requires: SELECT + INSERT.

revoke all on table
  public.jhadina_spatial_evidence,
  public.jhadina_spatial_reality_candidates,
  public.jhadina_spatial_reality_admissions,
  public.jhadina_spatial_workspace_revisions,
  public.jhadina_knowledge_nodes,
  public.jhadina_knowledge_relations
from service_role;

grant select, insert on table
  public.jhadina_spatial_evidence,
  public.jhadina_spatial_reality_candidates,
  public.jhadina_spatial_reality_admissions,
  public.jhadina_spatial_workspace_revisions,
  public.jhadina_knowledge_nodes,
  public.jhadina_knowledge_relations
to service_role;

revoke all on table
  public.jhadina_spatial_evidence,
  public.jhadina_spatial_reality_candidates,
  public.jhadina_spatial_reality_admissions,
  public.jhadina_spatial_workspace_revisions,
  public.jhadina_knowledge_nodes,
  public.jhadina_knowledge_relations
from anon, authenticated;
