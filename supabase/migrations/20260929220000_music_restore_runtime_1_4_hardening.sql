-- MUSIC-RESTORE.1-.4 post-deploy least-privilege and FK index hardening.

-- Existing Supabase projects can still inherit legacy default grants for
-- service_role. Revoke them explicitly, then grant only what the server
-- adapters actually use.
revoke all on public.music_restoration_cases from service_role;
revoke all on public.music_restoration_artifacts from service_role;
revoke all on public.music_restoration_evidence from service_role;
revoke all on public.music_restoration_jobs from service_role;
revoke all on public.music_restoration_versions from service_role;
revoke all on public.music_restoration_execution_receipts from service_role;

grant select,insert,update on public.music_restoration_cases to service_role;
grant select,insert on public.music_restoration_artifacts to service_role;
grant select,insert on public.music_restoration_evidence to service_role;
grant select,insert,update on public.music_restoration_jobs to service_role;
grant select,insert on public.music_restoration_versions to service_role;
grant select,insert on public.music_restoration_execution_receipts to service_role;

revoke execute on function public.assert_music_restoration_artifact_owner()
  from public,anon,authenticated;
revoke execute on function public.assert_music_restoration_job_owner()
  from public,anon,authenticated;
grant execute on function public.assert_music_restoration_artifact_owner()
  to service_role;
grant execute on function public.assert_music_restoration_job_owner()
  to service_role;

-- Cover every restoration foreign key that is not already a left-most prefix
-- of an existing index. This keeps parent/owner/source checks efficient as the
-- artifact and evidence history grows.
create index if not exists music_restoration_artifacts_owner_idx
  on public.music_restoration_artifacts(owner_user_id);
create index if not exists music_restoration_artifacts_parent_idx
  on public.music_restoration_artifacts(parent_artifact_id)
  where parent_artifact_id is not null;

create index if not exists music_restoration_evidence_case_idx
  on public.music_restoration_evidence(case_id);

create index if not exists music_restoration_jobs_owner_idx
  on public.music_restoration_jobs(owner_user_id);
create index if not exists music_restoration_jobs_source_idx
  on public.music_restoration_jobs(source_artifact_id);

create index if not exists music_restoration_versions_source_idx
  on public.music_restoration_versions(source_artifact_id);
create index if not exists music_restoration_versions_output_idx
  on public.music_restoration_versions(output_artifact_id);

create index if not exists music_restoration_execution_source_idx
  on public.music_restoration_execution_receipts(source_artifact_id);
create index if not exists music_restoration_execution_output_idx
  on public.music_restoration_execution_receipts(output_artifact_id)
  where output_artifact_id is not null;
