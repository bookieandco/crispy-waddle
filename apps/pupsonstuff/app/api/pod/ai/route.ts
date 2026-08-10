import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { queueAiCustomization } from "@/lib/pod/ai-job";

function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const creationId = String(body.creationId ?? "").trim();
    const sourceAssetId = String(body.sourceAssetId ?? "").trim();
    const style = String(body.style ?? "").trim();
    if (!creationId || !sourceAssetId || !style) return NextResponse.json({ error: "creationId, sourceAssetId, and style are required" }, { status: 400 });

    const result = await queueAiCustomization(serverClient(), { creationId, sourceAssetId, style, prompt: body.prompt });
    return NextResponse.json({ accepted: true, creationId, job: result.job, style, prompt: result.prompt }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to queue AI customization" }, { status: 500 });
  }
}
