import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: NextRequest) {
  try {
    const event = await request.json() as { type?: string; resource?: { id?: string; status?: string; shipments?: Array<{ number?: string }> }; metadata?: { creationId?: string } };
    const orderId = event.resource?.id;
    if (!orderId) return NextResponse.json({ ok: true });
    const supabase = adminClient();
    const tracking = event.resource?.shipments?.find((shipment) => shipment.number)?.number;
    const update: Record<string, string> = { provider_order_id: orderId, last_error: "" };
    if (event.type?.includes("shipment") || tracking) { update.stage = "shipping"; update.status = "queued"; if (tracking) update.tracking_number = tracking; }
    else if (event.type?.includes("order") || event.resource?.status) { update.stage = "production"; update.status = "queued"; }
    const query = supabase.from("pupson_pod_jobs").update(update).eq("provider", "printify").eq("provider_order_id", orderId);
    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook processing failed" }, { status: 500 });
  }
}
