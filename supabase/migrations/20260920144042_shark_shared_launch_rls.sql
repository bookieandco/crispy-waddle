-- SHARK-QA.17F: jhadina_token_launches is shared with the user-owned launch
-- registry. Keep owner-scoped client access while ensuring service-role SHARK
-- rows (owner_id is null) are never exposed through authenticated Data API reads.

alter table public.jhadina_token_launches enable row level security;

drop policy if exists jhadina_token_launches_select_authenticated
  on public.jhadina_token_launches;
drop policy if exists token_launches_select
  on public.jhadina_token_launches;
create policy token_launches_select
  on public.jhadina_token_launches
  for select
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists token_launches_insert
  on public.jhadina_token_launches;
create policy token_launches_insert
  on public.jhadina_token_launches
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists token_launches_update
  on public.jhadina_token_launches;
create policy token_launches_update
  on public.jhadina_token_launches
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
