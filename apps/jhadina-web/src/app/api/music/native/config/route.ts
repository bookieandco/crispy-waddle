import { NextResponse } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

export const dynamic = "force-dynamic";
/** Only public Supabase bootstrap values. Never returns secrets or user data. */
export async function GET() {
  try {
    const { url, publishableKey } = getSupabasePublicConfig();
    return NextResponse.json({
      success: true, data: { supabaseUrl: url, publishableKey },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ success:false,error:"Native music configuration unavailable" },
      { status:503,headers:{"Cache-Control":"no-store"} });
  }
}
