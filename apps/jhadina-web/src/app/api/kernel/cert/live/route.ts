import { NextRequest, NextResponse } from "next/server"
import {
  readKernelLiveCertification,
  runKernelLiveCertification,
} from "@/lib/kernel/live-certification"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store, private",
    },
  })
}

export async function POST() {
  try {
    const result = await runKernelLiveCertification()
    return privateJson({ ok: true, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "JHADINA_KERNEL_CERT_FAILED"
    const status = /Authenticated user missing|Authenticated session missing|identity/i.test(message) ? 401 : 500
    return privateJson({ ok: false, error: message }, status)
  }
}

export async function GET(request: NextRequest) {
  try {
    const actionId = request.nextUrl.searchParams.get("actionId")?.trim() ?? ""
    const result = await readKernelLiveCertification(actionId)
    return privateJson({ ok: true, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "JHADINA_KERNEL_CERT_READBACK_FAILED"
    const status = /ACTION_ID_REQUIRED/.test(message) ? 400
      : /Authenticated user missing|Authenticated session missing|identity/i.test(message) ? 401
        : 500
    return privateJson({ ok: false, error: message }, status)
  }
}
