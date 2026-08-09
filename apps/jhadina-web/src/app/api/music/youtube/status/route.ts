import { NextRequest, NextResponse } from "next/server";
import { decryptSecret } from "@/lib/youtube-oauth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const encrypted = req.cookies.get("jhadina_youtube_access")?.value;
  if (!encrypted) return NextResponse.json({ connected: false });
  try {
    decryptSecret(encrypted);
    return NextResponse.json({ connected: true, provider: "youtube" });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
