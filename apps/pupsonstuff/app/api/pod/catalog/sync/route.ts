import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PrintifyCatalogClient, type PrintifyCatalogProduct } from "@/lib/pod/printify-catalog";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false });
}

function requireSyncSecret(request: NextRequest) {
  const configured = process.env.POD_CATALOG_SYNC_SECRET;
  if (!configured) throw new Error("POD_CATALOG_SYNC_SECRET is not configured.");
  const supplied = request.headers.get("x-pod-sync-secret");
  if (!supplied || supplied !== configured) return false;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    if (!requireSyncSecret(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const apiKey = process.env.PRINTIFY_API_KEY;
    const shopId = process.env.PRINTIFY_SHOP_ID;
    if (!apiKey || !shopId) return NextResponse.json({ error: "Printify credentials are not configured." }, { status: 503 });

    const catalog = await new PrintifyCatalogClient(apiKey, shopId).listProducts();
    const rows = catalog.flatMap((product: PrintifyCatalogProduct) => (product.variants ?? []).filter((variant) => variant.is_enabled !== false).map((variant) => ({
      product_id: product.id,
      product_slug: product.id,
      product_name: product.title ?? product.id,
      variant_id: String(variant.id),
      printify_product_id: product.id,
      printify_blueprint_id: product.blueprint_id ?? null,
      printify_print_provider_id: product.print_provider_id ?? null,
      placement: "front",
      active: true,
    })));

    const supabase = adminClient();
    const { error } = await supabase.from("pupson_product_variants").upsert(rows, { onConflict: "product_id,variant_id" });
    if (error) throw error;

    return NextResponse.json({ ok: true, products: catalog.length, enabledVariants: rows.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Catalog sync failed" }, { status: 500 });
  }
}
