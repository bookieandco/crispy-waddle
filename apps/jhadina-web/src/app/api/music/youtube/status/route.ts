import { NextRequest, NextResponse } from "next/server";
import { decryptSecret } from "@/lib/youtube-oauth";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const configured=Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET &&
    process.env.JHADINA_OAUTH_ENCRYPTION_KEY && (process.env.YOUTUBE_REDIRECT_URI || process.env.NEXT_PUBLIC_APP_URL));
  if(!configured)return NextResponse.json({connected:false,configured:false,reason:"not_configured"},{headers:{"Cache-Control":"private, no-store"}});
  const encrypted = req.cookies.get("jhadina_youtube_access")?.value;
  const encryptedRefresh = req.cookies.get("jhadina_youtube_refresh")?.value;
  const owner = req.cookies.get("jhadina_youtube_owner")?.value;
  try {
    const identity = (await (await createRequestIdentityVerifier()).verify({})).userId;
    if (!owner || decryptSecret(owner) !== identity) return NextResponse.json({connected:false,reason:"reauthorize"});
    if (!encrypted && !encryptedRefresh) return NextResponse.json({connected:false,reason:"reauthorize"});
    decryptSecret(encrypted ?? encryptedRefresh!);
    return NextResponse.json({connected:true,configured:true,provider:"youtube",note:"Local authorization present; live API health is checked separately"});
  } catch {
    return NextResponse.json({connected:false,reason:"unavailable"});
  }
}
