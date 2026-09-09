import { NextRequest } from "next/server"
import { handleListCandidates } from "@/lib/routes/handlers"
import { withVerifiedUserHeader } from "@/lib/auth/with-verified-user-header"

/** Public boundary: identity is established from the verified Supabase session. */
export async function GET(req: NextRequest) {
  return withVerifiedUserHeader(req, handleListCandidates)
}
