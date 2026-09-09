import { createServiceRoleClient } from "@/lib/supabase/service-role"

/**
 * Server-side Money ownership boundary.
 *
 * Authentication answers "who is calling?". This check answers the separate
 * question "does that authenticated user own an active connection to this
 * provider?". Money Core remains responsible for capability/policy checks.
 *
 * The service-role client is intentionally used only on the server because
 * this table is not a browser-facing authorization surface.
 */
export async function assertMoneyProviderWorkspace(
  userId: string,
  provider = "plaid",
): Promise<void> {
  if (!userId) throw new Error("MONEY_USER_REQUIRED")

  const supabase = createServiceRoleClient()
  if (!supabase) throw new Error("MONEY_OWNERSHIP_STORE_UNAVAILABLE")

  const { data, error } = await supabase
    .from("money_provider_connections")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("status", "active")
    .limit(1)

  if (error) throw new Error(`MONEY_OWNERSHIP_CHECK_FAILED: ${error.message}`)
  if (!data?.length) throw new Error("MONEY_PROVIDER_WORKSPACE_DENIED")
}
