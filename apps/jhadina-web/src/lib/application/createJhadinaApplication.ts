import { Classifier } from "../services/Classifier"
import { JanetService } from "../services/JanetService"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import { InMemoryStorage } from "../storage/InMemoryStorage"
import type { MemoryStorage } from "../storage/MemoryStorage"
import {
  SupabaseActionIdentityVerifier,
  type JhadinaIdentityVerifier,
  type SupabaseClaimsClient,
} from "../auth/supabase-identity-verifier"

export type ExecutionReadiness =
  | { status: "ready"; executor: unknown }
  | {
      status: "not_configured"
      executor: null
      missing: readonly ("identity" | "policy" | "handlers" | "audit")[]
    }

export interface JhadinaApplication {
  /**
   * MemoryStorage instance. Production callers should pass a SupabaseMemoryStorage
   * via createJhadinaApplication({ storage }) rather than accepting the default
   * InMemoryStorage — see handlers.ts::getStorage() for the production singleton.
   */
  storage: MemoryStorage
  memoryRepo: MemoryRepository
  reasoningRepo: ReasoningEventRepository
  timelineRepo: TimelineRepository
  janet: JanetService
  identity: {
    createVerifier(supabase: SupabaseClaimsClient): JhadinaIdentityVerifier
  }
  execution: ExecutionReadiness
}

/**
 * Create a JhadinaApplication graph.
 *
 * @param overrides.storage - Supply a SupabaseMemoryStorage in production so
 *   memory is durable.  Defaults to InMemoryStorage (dev/test only — data is
 *   lost on process restart).  Production callers should use getJhadinaApplication()
 *   which delegates to getStorage() (Supabase-aware, fail-closed in production).
 *   Direct calls to this factory with no override are valid for tests only.
 *
 * Production persistence: getJhadinaApplication() now passes getStorage() as
 * the storage override, so the process singleton is always backed by the
 * Supabase-aware selection logic in handlers.ts::createStorage().  That
 * function throws (fails closed) in production when SUPABASE_SERVICE_ROLE_KEY
 * is not configured — ensuring the application cannot silently fall back to
 * InMemoryStorage in production.
 */
export function createJhadinaApplication(
  overrides: { storage?: MemoryStorage } = {},
): JhadinaApplication {
  const storage = overrides.storage ?? new InMemoryStorage()
  const memoryRepo = new MemoryRepository(storage)
  const reasoningRepo = new ReasoningEventRepository(storage)
  const timelineRepo = new TimelineRepository(storage)
  const janet = new JanetService(
    new Classifier(),
    memoryRepo,
    reasoningRepo,
    timelineRepo,
  )

  // Identity is request-scoped: the verifier is created from the authenticated
  // request's Supabase SSR client rather than stored as a process-global client.
  const identity = {
    createVerifier(supabase: SupabaseClaimsClient): JhadinaIdentityVerifier {
      return new SupabaseActionIdentityVerifier(supabase)
    },
  }

  // Fail closed until the application composition root has real production
  // policy, handlers, and durable audit dependencies in addition to identity.
  // Do not expose a placeholder executor as READY.
  const execution: ExecutionReadiness = {
    status: "not_configured",
    executor: null,
    missing: ["identity", "policy", "handlers", "audit"],
  }

  return {
    storage,
    memoryRepo,
    reasoningRepo,
    timelineRepo,
    janet,
    identity,
    execution,
  }
}

let application: JhadinaApplication | undefined

/**
 * Returns the process-local application graph. This keeps all route handlers
 * in the same runtime instance on long-lived Node/serverless workers while
 * remaining replaceable through createJhadinaApplication() in tests.
 *
 * NOTE: The singleton defaults to InMemoryStorage because the application
 * layer must not import from the routes layer (handlers.ts). The only
 * production caller, request-identity.ts, accesses application.identity
 * only — it never reads application.storage for durable persistence.
 * All route handlers that need durable storage call getStorage() from
 * handlers.ts directly, which is the Supabase-aware, fail-closed path.
 *
 * If application.storage is ever used for production persistence, inject
 * the durable storage by calling createJhadinaApplication({ storage })
 * from a composition root that already has getStorage() in scope.
 */
export function getJhadinaApplication(): JhadinaApplication {
  if (!application) application = createJhadinaApplication()
  return application
}
