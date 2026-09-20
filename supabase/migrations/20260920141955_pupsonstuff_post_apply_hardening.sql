-- Harden legacy PupsonStuff trigger functions surfaced by the post-deploy
-- Supabase security advisor. Trigger execution does not require browser roles
-- to retain direct EXECUTE privileges.
alter function public.create_pupson_pod_job_for_creation() set search_path = '';
alter function public.set_pupson_product_variant_updated_at() set search_path = '';
alter function public.set_pupson_updated_at() set search_path = '';
alter function public.pupson_orders_set_updated_at() set search_path = '';

revoke all on function public.create_pupson_pod_job_for_creation() from public, anon, authenticated;
revoke all on function public.set_pupson_product_variant_updated_at() from public, anon, authenticated;
revoke all on function public.set_pupson_updated_at() from public, anon, authenticated;
revoke all on function public.pupson_orders_set_updated_at() from public, anon, authenticated;

grant execute on function public.create_pupson_pod_job_for_creation() to service_role;
grant execute on function public.set_pupson_product_variant_updated_at() to service_role;
grant execute on function public.set_pupson_updated_at() to service_role;
grant execute on function public.pupson_orders_set_updated_at() to service_role;

-- Cover the foreign keys reported by the performance advisor. These indexes
-- also make retention cleanup and ownership-safe joins predictable at scale.
create index if not exists pupson_jobs_pet_identity_idx
  on public.pupson_creative_jobs (pet_identity_id);
create index if not exists pupson_outputs_generated_asset_idx
  on public.pupson_creative_outputs (generated_asset_id);
create index if not exists pupson_outputs_print_asset_idx
  on public.pupson_creative_outputs (print_asset_id) where print_asset_id is not null;
create index if not exists pupson_media_source_asset_idx
  on public.pupson_media_assets (source_asset_id) where source_asset_id is not null;
create index if not exists pupson_order_items_creative_output_idx
  on public.pupson_order_items (creative_output_id) where creative_output_id is not null;
create index if not exists pupson_order_items_print_asset_idx
  on public.pupson_order_items (print_asset_id) where print_asset_id is not null;
create index if not exists pupson_pet_primary_asset_idx
  on public.pupson_pet_identities (primary_asset_id) where primary_asset_id is not null;
create index if not exists pupson_pet_identity_media_asset_idx
  on public.pupson_pet_identity_assets (media_asset_id);
