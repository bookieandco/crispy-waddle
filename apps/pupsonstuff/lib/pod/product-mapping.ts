import type { SupabaseClient } from "@supabase/supabase-js";

export type ProductVariantMapping = { productId: string; productSlug: string; productName: string; variantId: string; printifyProductId: string; printifyBlueprintId?: number; printifyPrintProviderId?: number; placement: string; artworkWidthPx?: number; artworkHeightPx?: number };

export async function getProductVariantMapping(supabase: SupabaseClient, productId: string, variantId: string) {
  const { data, error } = await supabase.from("pupson_product_variants").select("*").eq("product_id", productId).eq("variant_id", variantId).eq("active", true).single();
  if (error) throw error;
  return data as ProductVariantMapping;
}

export async function listActiveProductVariants(supabase: SupabaseClient, productId: string) {
  const { data, error } = await supabase.from("pupson_product_variants").select("*").eq("product_id", productId).eq("active", true).order("variant_id");
  if (error) throw error;
  return data as ProductVariantMapping[];
}
