import { NextRequest } from "next/server"
import { handleMessage } from "@/lib/routes/handlers"
import { withVerifiedUserHeader } from "@/lib/auth/with-verified-user-header"

/** Public boundary: messages are always attributed to the verified session user. */
export async function POST(req: NextRequest) {
  return withVerifiedUserHeader(req, handleMessage)
}
