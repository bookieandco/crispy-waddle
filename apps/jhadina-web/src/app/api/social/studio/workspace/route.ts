import { NextRequest, NextResponse } from "next/server"
import type { JhadinaBrand, SocialStudioWorkspace } from "@jhadina/social-core"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import {
  loadSocialStudioWorkspace, saveSocialStudioWorkspace,
} from "@/lib/social/studio-workspace-repository"

export const dynamic = "force-dynamic"

const BRANDS = new Set<JhadinaBrand>([
  "pupsonstuff", "atwood-bookie", "bookieandco", "jhadina-music",
  "jhadinatv", "jhadina", "overageos", "truckeros",
])
const HEADERS = { "Cache-Control": "private, no-store" }

function validBrand(value: unknown): value is JhadinaBrand {
  return typeof value === "string" && BRANDS.has(value as JhadinaBrand)
}
function errResponse(error: unknown) {
  const reason = error instanceof Error ? error.message : ""
  if (reason === "SOCIAL_STUDIO_STORAGE_NOT_COMMISSIONED") {
    return NextResponse.json({ success: false, error: "Studio saving has not been enabled." },
      { status: 503, headers: HEADERS })
  }
  if (reason === "SOCIAL_STUDIO_REVISION_CONFLICT") {
    return NextResponse.json({ success: false, error: "Studio changed elsewhere. Reload before saving." },
      { status: 409, headers: HEADERS })
  }
  if (reason.includes("Authenticated") || reason.includes("session") || reason.includes("OWNER")) {
    return NextResponse.json({ success: false, error: "Sign in is required." },
      { status: 401, headers: HEADERS })
  }
  return NextResponse.json({ success: false, error: "Studio request could not be completed." },
    { status: 400, headers: HEADERS })
}

export async function GET(req: NextRequest) {
  try {
    const owner = (await (await createRequestIdentityVerifier()).verify({})).userId
    const brand = req.nextUrl.searchParams.get("brand")
    if (!validBrand(brand)) {
      return NextResponse.json({ success: false, error: "Choose a valid brand." }, { status: 400, headers: HEADERS })
    }
    const data = await loadSocialStudioWorkspace(owner, brand)
    return NextResponse.json({ success: true, data }, { headers: HEADERS })
  } catch (error) {
    return errResponse(error)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const owner = (await (await createRequestIdentityVerifier()).verify({})).userId
    const raw = await req.text()
    if (raw.length > 200_000) {
      return NextResponse.json({ success: false, error: "Studio workspace too large." },
        { status: 413, headers: HEADERS })
    }
    const body = JSON.parse(raw) as {
      brand?: unknown
      workspace?: SocialStudioWorkspace
      expectedRevision?: unknown
    }
    if (!validBrand(body.brand) || !body.workspace ||
        (body.expectedRevision !== null &&
        (typeof body.expectedRevision !== "number" || !Number.isSafeInteger(body.expectedRevision)))) {
      return NextResponse.json({ success: false, error: "Studio workspace or revision invalid." },
        { status: 400, headers: HEADERS })
    }
    const data = await saveSocialStudioWorkspace({
      userId: owner, brand: body.brand, workspace: body.workspace,
      expectedRevision: body.expectedRevision as number | null,
    })
    return NextResponse.json({ success: true, data }, { headers: HEADERS })
  } catch (error) {
    return errResponse(error)
  }
}
