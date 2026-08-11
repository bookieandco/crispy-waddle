import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { SupabaseClient } from "@supabase/supabase-js"

const SUPABASE_URL_ENV = "NEXT_PUBLIC_SUPABASE_URL"
const SUPABASE_PUBLISHABLE_KEY_ENV = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
const SUPABASE_ANON_KEY_ENV = "NEXT_PUBLIC_SUPABASE_ANON_KEY"

function requiredEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

/**
 * Creates a request-scoped Supabase client for Next.js server code.
 *
 * Only the public project URL and publishable/anon key are accepted here.
 * Service-role credentials must never be used by this helper or exposed to
 * browser code.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()
  const url = requiredEnv(SUPABASE_URL_ENV, process.env[SUPABASE_URL_ENV])
  const key = requiredEnv(
    SUPABASE_PUBLISHABLE_KEY_ENV,
    process.env[SUPABASE_PUBLISHABLE_KEY_ENV] ?? process.env[SUPABASE_ANON_KEY_ENV],
  )

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Route handlers can persist refreshed auth cookies. In contexts
          // where Next.js exposes a read-only cookie store, the request can
          // still use the verified claims already present in the session.
        }
      },
    },
  })
}

export function assertPublicSupabaseEnvironment(): void {
  requiredEnv(SUPABASE_URL_ENV, process.env[SUPABASE_URL_ENV])
  requiredEnv(
    SUPABASE_PUBLISHABLE_KEY_ENV,
    process.env[SUPABASE_PUBLISHABLE_KEY_ENV] ?? process.env[SUPABASE_ANON_KEY_ENV],
  )
}
