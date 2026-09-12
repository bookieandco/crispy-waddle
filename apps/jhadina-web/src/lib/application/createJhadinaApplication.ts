import { Classifier } from "../services/Classifier"
import { JanetService } from "../services/JanetService"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import { createMemoryStorage } from "../storage/createMemoryStorage"
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
  memoryRepo: MemoryRepository
  reasoningRepo: ReasoningEventRepository
  timelineRepo: TimelineRepository
  janet: JanetService
  identity: {
    createVerifier(supabase: SupabaseClaimsClient): JhadinaIdentityVerifier
  }
  execution: ExecutionReadiness
}

export function createJhadinaApplication(): JhadinaApplication {
  const storage = createMemoryStorage()
  const memoryRepo = new MemoryRepository(storage)
  const reasoningRepo = new ReasoningEventRepository(storage)
  const timelineRepo = new TimelineRepository(storage)
  const janet = new JanetService(
    new Classifier(),
    memoryRepo,
    reasoningRepo,
    timelineRepo,
  )

  const identity = {
    createVerifier(supabase: SupabaseClaimsClient): JhadinaIdentityVerifier {
      return new SupabaseActionIdentityVerifier(supabase)
    },
  }

  const execution: ExecutionReadiness = {
    status: "not_configured",
    executor: null,
    missing: ["identity", "policy", "handlers", "audit"],
  }

  return {
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
 * Returns the process-local application graph. Storage is intentionally
 * private to the composition root; callers receive governed repositories,
 * never raw persistence capabilities.
 */
export function getJhadinaApplication(): JhadinaApplication {
  if (!application) application = createJhadinaApplication()
  return application
}
