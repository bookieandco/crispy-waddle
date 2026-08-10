import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const productId = String(body.productId ?? "").trim();
    if (!productId) return NextResponse.json({ error: "productId is required" }, { status: 400 });

    const supabase = serverClient();
    const { data, error } = await supabase.from("pupson_creations").insert({
      customer_id: body.customerId ?? null,
      product_id: productId,
      variant_id: body.variantId ?? null,
      customization_prompt: body.customizationPrompt ?? null,
    }).select("id,product_id,variant_id,status,created_at").single();
    if (error) throw error;

    return NextResponse.json({ creation: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create PupsonStuff creation" }, { status: 500 });
  }
}
