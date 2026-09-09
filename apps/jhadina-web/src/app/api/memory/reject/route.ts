import { NextRequest } from "next/server"
import { handleRejectMemory } from "@/lib/routes/handlers"
import { withVerifiedUserHeader } from "@/lib/auth/with-verified-user-header"

/** Public boundary: rejection is scoped to the server-verified session user. */
export async function POST(req: NextRequest) {
  return withVerifiedUserHeader(req, handleRejectMemory)
}
