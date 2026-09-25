alter table public.pupson_catalog_variants
  alter column provider_product_id drop not null;

comment on column public.pupson_catalog_variants.provider_product_id is
  'Optional Printify shop product id. Null means fulfillment uses the certified raw blueprint/print-provider/variant mapping instead of a pre-created shop product.';
