-- LOCAL-GOV.PRIME-COVERAGE — expand jurisdiction inventory beyond state/county.

alter table public.jhadina_public_jurisdictions
  drop constraint if exists jhadina_public_jurisdictions_level_check;

alter table public.jhadina_public_jurisdictions
  add constraint jhadina_public_jurisdictions_level_check
  check (level in (
    'state','county','city','school_district','special_district',
    'authority','public_university','public_hospital'
  ));

alter table public.jhadina_public_jurisdictions
  add column if not exists jurisdiction_geoid text,
  add column if not exists jurisdiction_subtype text;

create index if not exists jhadina_public_jurisdictions_level_state_idx
  on public.jhadina_public_jurisdictions (level,state_code,normalized_name);

update public.jhadina_public_jurisdictions
   set jurisdiction_geoid = county_geoid
 where level='county'
   and jurisdiction_geoid is null;

update public.jhadina_public_source_discovery_jobs j
   set priority = case x.level
     when 'state' then 10
     when 'school_district' then 20
     when 'city' then 25
     when 'county' then 30
     when 'special_district' then 35
     when 'authority' then 35
     when 'public_university' then 40
     when 'public_hospital' then 40
     else 50
   end,
   updated_at = now()
  from public.jhadina_public_jurisdictions x
 where x.id=j.jurisdiction_id;
