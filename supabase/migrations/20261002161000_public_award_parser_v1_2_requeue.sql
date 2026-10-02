-- LOCAL-GOV.PROD — re-admit verified transactional procurement award sources for adapter v1.2.
--
-- Adapter v1.2 adds award-aware parsing (awardee/date/value) and must not inherit
-- v1.1 shadow-trial debt. Requeue only sources with explicit transactional award
-- evidence; civic/employee/community/recognition award pages remain degraded.

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
    lower(source_name) ~ '(awarded[[:space:]-]+(bids?|contracts?|rfps?|rfqs?|proposals?|tenders?)|bids?[[:space:]-]+awarded|bid[[:space:]-]+awards?|contract[[:space:]-]+awards?|award[[:space:]-]+recommendations?|notice of( intent to)? award|bid[[:space:]-]+results?|successful bidder|recommended awardee|award[[:space:]-]+postings?|status[[:space:]:-]*awarded|closed.*awarded.*(bids?|rfps?|rfqs?|solicitations?)|solicitation opportunities?[[:space:]&and-]*awards?)'
    or lower(source_url) ~ '(awarded[-_/]?(bids?|contracts?|rfp|rfq|proposals?|tenders?)|bids?[-_/]?awarded|award[-_/]?recommend|notice[-_/]?(of[-_/]?)?(intent[-_/]?to[-_/]?)?award|contract[-_/]?awards?|bid[-_/]?awards?|award[-_/]?postings?|centralized[-_/]?awards?|/(procurement|purchasing|purchase)/[^?]*(awarded|award[-_/]?(recommend|posting|notice|contract|bid))|/(purchase|purchasing)/[^?]*/awards?/)'
  )
  and lower(source_name) !~ '(awards?[[:space:]&and-]*(recognition|recognitions)|achievements?[[:space:]&and-]*awards?|annual awards?|employee .*awards?|service awards?|excellence .*award|project of the year|community .*award|mayor.*award)';
