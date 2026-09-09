import { NextRequest } from "next/server"
import { handleApproveMemory } from "@/lib/routes/handlers"
import { withVerifiedUserHeader } from "@/lib/auth/with-verified-user-header"

/** Public boundary: approval is scoped to the server-verified session user. */
export async function POST(req: NextRequest) {
  return withVerifiedUserHeader(req, handleApproveMemory)
}
