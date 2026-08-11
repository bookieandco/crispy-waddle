import type { ActionIdentityVerifier } from "@jhadina/action-core"
import { Classifier } from "../services/Classifier"
import { JanetService } from "../services/JanetService"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import { InMemoryStorage } from "../storage/InMemoryStorage"
import {
  SupabaseActionIdentityVerifier,
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
  storage: InMemoryStorage
  memoryRepo: MemoryRepository
  reasoningRepo: ReasoningEventRepository
  timelineRepo: TimelineRepository
  janet: JanetService
  identity: {
    createVerifier(supabase: SupabaseClaimsClient): ActionIdentityVerifier
  }
  execution: ExecutionReadiness
}

export function createJhadinaApplication(): JhadinaApplication {
  const storage = new InMemoryStorage()
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
    createVerifier(supabase: SupabaseClaimsClient): ActionIdentityVerifier {
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
 */
export function getJhadinaApplication(): JhadinaApplication {
  if (!application) application = createJhadinaApplication()
  return application
}
