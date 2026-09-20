import type {
  SamPursuitSnapshotEnvelope,
  SamPursuitSnapshotRepository,
} from "@jhadina/opportunity-core"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

type SnapshotRow = {
  snapshot: SamPursuitSnapshotEnvelope["snapshot"]
  checksum: string
}

export function createSupabaseSamPursuitSnapshotRepository(
  verifiedUserId: string,
): SamPursuitSnapshotRepository {
  if (!verifiedUserId.trim()) throw new Error("Verified user id is required for SAM pursuit persistence")

  return {
    async load(opportunityId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_sam_pursuit_snapshots")
        .select("snapshot, checksum")
        .eq("opportunity_id", opportunityId)
        .maybeSingle<SnapshotRow>()

      if (error) {
        throw new Error(`Unable to load SAM pursuit snapshot: ${error.message}`)
      }
      if (!data) return null
      return { snapshot: data.snapshot, checksum: data.checksum }
    },

    async save(envelope, expectedRevision) {
      const trusted = createServiceRoleClient()
      if (!trusted) {
        throw new Error("SAM pursuit persistence service role is not configured")
      }
      const { data, error } = await trusted.rpc("jhadina_sam_pursuit_snapshot_save_trusted", {
        p_user_id: verifiedUserId,
        p_envelope: envelope,
        p_expected_revision: expectedRevision,
      })

      if (error || !data) {
        throw new Error(`Unable to save SAM pursuit snapshot: ${error?.message ?? "no result returned"}`)
      }
    },
  }
}
