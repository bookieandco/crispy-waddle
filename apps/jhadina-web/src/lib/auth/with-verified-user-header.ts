import { NextRequest } from "next/server"
import { requireAuthenticatedUser } from "./require-authenticated-user"

/**
 * Compatibility bridge for the legacy Janet route handlers.
 *
 * Those handlers still accept x-user-id internally, so public routes must
 * never forward the browser's header. This wrapper overwrites it with the
 * user ID obtained from the server-verified Supabase session.
 *
 * New governed routes should derive identity directly and should not add
 * another caller-controlled identity header.
 */
export async function withVerifiedUserHeader(
  req: NextRequest,
  handler: (request: NextRequest) => Promise<Response>,
): Promise<Response> {
  try {
    const { userId } = await requireAuthenticatedUser()
    const headers = new Headers(req.headers)
    headers.set("x-user-id", userId)
    return handler(new NextRequest(req.url, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
    }))
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }
}
