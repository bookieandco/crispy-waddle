import { NextRequest } from "next/server"
import { handleListMemories } from "@/lib/routes/handlers"
import { withVerifiedUserHeader } from "@/lib/auth/with-verified-user-header"

/** Public boundary: memory reads are scoped to the verified session user. */
export async function GET(req: NextRequest) {
  return withVerifiedUserHeader(req, handleListMemories)
}
