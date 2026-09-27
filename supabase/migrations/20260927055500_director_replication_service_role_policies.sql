-- Explicit least-privilege RLS policy receipts for Director replication/project envelopes.
-- API clients remain revoked; service_role is the only database role admitted here.

create policy director_process_replication_service_role_only
  on public.director_process_replication_jobs
  as restrictive for all
  to service_role
  using (true)
  with check (true);

create policy director_production_projects_service_role_only
  on public.director_production_projects
  as restrictive for all
  to service_role
  using (true)
  with check (true);
