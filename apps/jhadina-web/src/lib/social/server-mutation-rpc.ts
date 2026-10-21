import { createRequestIdentityVerifier } from "../auth/request-identity"
import { createRuntimeServiceRoleClient } from "../supabase/service-role"

/**
 * Only the server may invoke this narrowly allowlisted dispatcher. The
 * database must REVOKE authenticated EXECUTE on every direct mutation RPC.
 *
 * The configured/commissioned flag is OFF by default. Do not turn it on
 * before the service-only SQL proposal and authenticated-owner denial tests.
 */
export const SOCIAL_RPC_AUTHORITY_FLAG = "JHADINA_SOCIAL_RPC_AUTHORITY_HARDENED"

const MUTATIONS = [
  "jhadina_social_create_proposal",
  "jhadina_social_create_approval_receipt",
  "jhadina_social_attach_approval_receipt",
  "jhadina_social_approve_receipt",
  "jhadina_social_consume_approval_receipt",
  "jhadina_social_enqueue_outbox",
  "jhadina_social_begin_outbox_attempt",
  "jhadina_social_complete_outbox",
  "jhadina_social_fail_outbox",
  "jhadina_social_record_observation",
  "jhadina_social_publish_canary_create",
  "jhadina_social_publish_canary_capture_outbox",
  "jhadina_social_upsert_contact_state",
  "jhadina_social_create_message_proposal",
  "jhadina_social_attach_message_approval",
  "jhadina_social_enqueue_message_outbox",
  "jhadina_social_begin_message_attempt",
  "jhadina_social_complete_message_outbox",
  "jhadina_social_fail_message_outbox",
] as const

export type SocialServerMutation = (typeof MUTATIONS)[number]

export async function executeSocialServerMutation<T>(
  claimedOwnerUserId: string,
  operation: SocialServerMutation,
  argumentsObject: Record<string, unknown>,
): Promise<T> {
  if (process.env[SOCIAL_RPC_AUTHORITY_FLAG] !== "true") {
    throw new Error("SOCIAL_RPC_AUTHORITY_NOT_COMMISSIONED")
  }
  if (!MUTATIONS.includes(operation)) {
    throw new Error("SOCIAL_RPC_OPERATION_FORBIDDEN")
  }
  const verifier = await createRequestIdentityVerifier()
  const identity = await verifier.verify({})
  if (!identity.userId || identity.userId !== claimedOwnerUserId) {
    throw new Error("SOCIAL_RPC_OWNER_IDENTITY_MISMATCH")
  }
  const privileged = await createRuntimeServiceRoleClient()
  if (!privileged) throw new Error("SOCIAL_RPC_PRIVILEGED_RUNTIME_UNAVAILABLE")

  // The service-role key / production OIDC credential is never exposed to the
  // caller. SQL only accepts this RPC from service_role; client JWTs lack GRANT.
  const { data, error } = await privileged.rpc("jhadina_social_server_mutation", {
    p_owner_user_id: identity.userId,
    p_operation: operation,
    p_arguments: argumentsObject,
  })
  if (error) throw new Error("SOCIAL_RPC_SERVER_MUTATION_FAILED")
  return data as T
}
