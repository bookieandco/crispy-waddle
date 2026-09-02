import { SupabaseApprovalReceiptStore, type ApprovalReceiptStore } from "@jhadina/action-core"
import { createClient } from "../supabase/server"

/**
 * Production approval-receipt composition root shared by governed app domains.
 *
 * The domain runtimes own policy/identity; this helper owns only construction
 * of the durable receipt store. Tests should inject their own store rather than
 * calling this helper.
 */
export async function createDurableApprovalReceiptStore(): Promise<ApprovalReceiptStore> {
  return new SupabaseApprovalReceiptStore(await createClient())
}
