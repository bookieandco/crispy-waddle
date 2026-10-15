-- DB-RECOVER.04 / SWLC. READ ONLY. Presence != migration history provenance.
with probes(filename,kind,name) as (values
('20260902013135_director_generation_submission_outbox.sql','relation','director_generation_submission_outbox'),
('20260902013135_director_generation_submission_reservation.sql','function','reserve_director_generation_submission'),
('20260920190000_director_production_authority.sql','relation','director_production_runs'),
('20260920190000_safety_prod_gate_5_runtime_proofs.sql','relation','jhadina_safety_runtime_proofs'),
('20260920200000_director_media_review.sql','relation','director_media_review_decisions'),
('20260920200000_jhadina_money_bank_ownership.sql','relation','jhadina_money_bank_connections'),
('20260920210000_director_review_transitions.sql','relation','director_review_transitions'),
('20260920210000_jhadina_money_bank_credential_hardening.sql','function','jhadina_money_owned_account_ids'),
('20261001120000_government_demand_radar.sql','relation','jhadina_government_demand_profiles'),
('20261001120000_public_dotgov_domain_registry.sql','relation','jhadina_public_official_domains'),
('20261003221000_director_durable_workstation_timeline.sql','relation','director_workstation_timelines'),
('20261003221000_side_hustle_digital_product_studio_registry.sql','relation','jhadina_digital_product_studio_records'),
('20261005023000_director_post_task_receipts.sql','relation','director_post_task_receipts'),
('20261005023000_director_watch_commissioning_receipts.sql','relation','director_watch_commissioning_receipts'),
('20261005024500_director_business_canary_receipts.sql','relation','director_business_canary_receipts'),
('20261005024500_director_visual_annotation_provider.sql','relation','director_visual_annotation_tasks')
)
select jsonb_build_object('observedAt', now(), 'representativeObjects',
 coalesce(jsonb_agg(jsonb_build_object('file',filename,'kind',kind,'name',name,
 'present',case when kind='relation' then to_regclass(format('public.%I',name)) is not null
 else exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n
 on n.oid=p.pronamespace where n.nspname='public' and p.proname=name) end)
 order by filename),'[]'::jsonb)) as collision_object_probe
from probes;
