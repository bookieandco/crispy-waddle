-- Durable PupsonStuff creative identity/job security layer.
-- The pupson-assets bucket is private and is provisioned separately.
-- User objects use: pet-assets/<owner_id>/<pet_identity_id>/<asset_id>.<ext>

create index if not exists pupson_pet_identity_assets_asset_idx
  on public.pupson_pet_identity_assets (asset_id);

create index if not exists pupson_creative_jobs_pet_identity_idx
  on public.pupson_creative_jobs (pet_identity_id, created_at desc);

alter table public.pupson_media_assets enable row level security;
alter table public.pupson_pet_identities enable row level security;
alter table public.pupson_pet_identity_assets enable row level security;
alter table public.pupson_creative_jobs enable row level security;
alter table public.pupson_creative_outputs enable row level security;

revoke all on table public.pupson_media_assets, public.pupson_pet_identities,
  public.pupson_pet_identity_assets, public.pupson_creative_jobs,
  public.pupson_creative_outputs from anon;

grant select, insert, update, delete on table public.pupson_media_assets,
  public.pupson_pet_identities, public.pupson_pet_identity_assets,
  public.pupson_creative_jobs, public.pupson_creative_outputs to authenticated;

-- Rebuild the policies so cross-owner foreign-key references cannot be smuggled in.
drop policy if exists "pupson media owner select" on public.pupson_media_assets;
drop policy if exists "pupson media owner insert" on public.pupson_media_assets;
drop policy if exists "pupson media owner update" on public.pupson_media_assets;
drop policy if exists "pupson media owner delete" on public.pupson_media_assets;
create policy "pupson media owner select" on public.pupson_media_assets for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "pupson media owner insert" on public.pupson_media_assets for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "pupson media owner update" on public.pupson_media_assets for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "pupson media owner delete" on public.pupson_media_assets for delete to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "pupson pet identity owner select" on public.pupson_pet_identities;
drop policy if exists "pupson pet identity owner insert" on public.pupson_pet_identities;
drop policy if exists "pupson pet identity owner update" on public.pupson_pet_identities;
drop policy if exists "pupson pet identity owner delete" on public.pupson_pet_identities;
create policy "pupson pet identity owner select" on public.pupson_pet_identities for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "pupson pet identity owner insert" on public.pupson_pet_identities for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "pupson pet identity owner update" on public.pupson_pet_identities for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "pupson pet identity owner delete" on public.pupson_pet_identities for delete to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "pupson pet identity assets owner select" on public.pupson_pet_identity_assets;
drop policy if exists "pupson pet identity assets owner insert" on public.pupson_pet_identity_assets;
drop policy if exists "pupson pet identity assets owner update" on public.pupson_pet_identity_assets;
drop policy if exists "pupson pet identity assets owner delete" on public.pupson_pet_identity_assets;
create policy "pupson pet identity assets owner select" on public.pupson_pet_identity_assets for select to authenticated
  using (exists (select 1 from public.pupson_pet_identities p
    where p.id = pet_identity_id and p.owner_id = (select auth.uid())));
create policy "pupson pet identity assets owner insert" on public.pupson_pet_identity_assets for insert to authenticated
  with check (exists (select 1 from public.pupson_pet_identities p
    join public.pupson_media_assets a on a.id = asset_id
    where p.id = pet_identity_id and p.owner_id = (select auth.uid())
      and a.owner_id = (select auth.uid())));
create policy "pupson pet identity assets owner update" on public.pupson_pet_identity_assets for update to authenticated
  using (exists (select 1 from public.pupson_pet_identities p
    where p.id = pet_identity_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.pupson_pet_identities p
    join public.pupson_media_assets a on a.id = asset_id
    where p.id = pet_identity_id and p.owner_id = (select auth.uid())
      and a.owner_id = (select auth.uid())));
create policy "pupson pet identity assets owner delete" on public.pupson_pet_identity_assets for delete to authenticated
  using (exists (select 1 from public.pupson_pet_identities p
    where p.id = pet_identity_id and p.owner_id = (select auth.uid())));

drop policy if exists "pupson creative job owner select" on public.pupson_creative_jobs;
drop policy if exists "pupson creative job owner insert" on public.pupson_creative_jobs;
drop policy if exists "pupson creative job owner update" on public.pupson_creative_jobs;
drop policy if exists "pupson creative job owner delete" on public.pupson_creative_jobs;
create policy "pupson creative job owner select" on public.pupson_creative_jobs for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "pupson creative job owner insert" on public.pupson_creative_jobs for insert to authenticated
  with check ((select auth.uid()) = owner_id and
    (pet_identity_id is null or exists (select 1 from public.pupson_pet_identities p
      where p.id = pet_identity_id and p.owner_id = (select auth.uid()))));
create policy "pupson creative job owner update" on public.pupson_creative_jobs for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id and
    (pet_identity_id is null or exists (select 1 from public.pupson_pet_identities p
      where p.id = pet_identity_id and p.owner_id = (select auth.uid()))));
create policy "pupson creative job owner delete" on public.pupson_creative_jobs for delete to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "pupson creative output owner select" on public.pupson_creative_outputs;
drop policy if exists "pupson creative output owner insert" on public.pupson_creative_outputs;
drop policy if exists "pupson creative output owner update" on public.pupson_creative_outputs;
drop policy if exists "pupson creative output owner delete" on public.pupson_creative_outputs;
create policy "pupson creative output owner select" on public.pupson_creative_outputs for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "pupson creative output owner insert" on public.pupson_creative_outputs for insert to authenticated
  with check ((select auth.uid()) = owner_id and
    exists (select 1 from public.pupson_creative_jobs j
      where j.id = creative_job_id and j.owner_id = (select auth.uid())) and
    (asset_id is null or exists (select 1 from public.pupson_media_assets a
      where a.id = asset_id and a.owner_id = (select auth.uid()))));
create policy "pupson creative output owner update" on public.pupson_creative_outputs for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id and
    exists (select 1 from public.pupson_creative_jobs j
      where j.id = creative_job_id and j.owner_id = (select auth.uid())) and
    (asset_id is null or exists (select 1 from public.pupson_media_assets a
      where a.id = asset_id and a.owner_id = (select auth.uid()))));
create policy "pupson creative output owner delete" on public.pupson_creative_outputs for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- pupson-assets is private. These policies isolate the new Pet Identity paths
-- from the legacy creation paths already present in the bucket.
create policy "pupson pet assets authenticated select" on storage.objects
  for select to authenticated
  using (bucket_id = 'pupson-assets'
    and (storage.foldername(name))[1] = 'pet-assets'
    and (storage.foldername(name))[2] = (select auth.uid()::text));
create policy "pupson pet assets authenticated insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pupson-assets'
    and (storage.foldername(name))[1] = 'pet-assets'
    and (storage.foldername(name))[2] = (select auth.uid()::text));
create policy "pupson pet assets authenticated update" on storage.objects
  for update to authenticated
  using (bucket_id = 'pupson-assets'
    and (storage.foldername(name))[1] = 'pet-assets'
    and (storage.foldername(name))[2] = (select auth.uid()::text))
  with check (bucket_id = 'pupson-assets'
    and (storage.foldername(name))[1] = 'pet-assets'
    and (storage.foldername(name))[2] = (select auth.uid()::text));
create policy "pupson pet assets authenticated delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pupson-assets'
    and (storage.foldername(name))[1] = 'pet-assets'
    and (storage.foldername(name))[2] = (select auth.uid()::text));
