-- LOCAL-GOV.PROD — re-admit verified procurement award sources for adapter v1.2.
--
-- Adapter v1.2 adds award-aware parsing (awardee/date/value) and must not inherit
-- v1.1 shadow-trial debt. Requeue only sources with explicit procurement context;
-- generic civic/employee/community "awards" pages remain degraded.

update public.jhadina_public_procurement_sources
set adapter_status='adapter_required',
    adapter_key=null,
    adapter_version=null,
    certified_at=null,
    last_adapter_trial_at=null,
    blockers=array_append(
      array_remove(coalesce(blockers,array[]::text[]),'award_parser_v1_2_requeue'),
      'award_parser_v1_2_requeue'
    ),
    updated_at=now()
where source_kinds @> array['award']::text[]
  and verification_status in ('official_owner_verified','official_portal_verified')
  and adapter_kind in ('html','api','rss')
  and adapter_status in ('active','degraded')
  and (
    lower(source_name) ~ '(procure|purchas|bid|contract|vendor|solicitation|rfp|rfq|public works)' or
    lower(source_url) ~ '(procure|purchas|bid|contract|vendor|solicitation|rfp|rfq|public[-_/]?works)'
  );
