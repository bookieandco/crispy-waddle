import { NextRequest, NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { readJllmReasoningReadiness } from "@/lib/intelligence/production-model-provider"

export const dynamic = "force-dynamic"

/** Read-only status; no inference call, new credential, or model charge. */
export async function GET(request: NextRequest) {
  const claimed = request.headers.get("x-jhadina-user-id")?.trim()
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" }
  if (!claimed) return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401, headers })
  try {
    await (await createRequestIdentityVerifier()).verify({userId:claimed})
    return NextResponse.json({success:true, data:readJllmReasoningReadiness()}, {headers})
  } catch {
    return NextResponse.json({success:false,error:"Owner session verification required"}, {status:401,headers})
  }
}
