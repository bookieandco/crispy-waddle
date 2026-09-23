import type {
  JhadinaWorkSession,
  WorkSessionContext,
  WorkSessionRepository,
} from "@jhadina/core-spine"
import type { WorkSessionContextProvider } from "./context-builder"
import { redactSecrets } from "./redact"
import { createServiceRoleClient } from "../supabase/service-role"
import { SupabaseWorkSessionRepository } from "../work-session/supabase-work-session-repository"

export interface ProductionWorkSessionContextProviderOptions {
  repository?: WorkSessionRepository
}

const MAX_SUBSYSTEMS = 24
const MAX_ARTIFACT_REFS = 32
const MAX_DECISION_REFS = 64
const MAX_OUTPUT_REFS = 64

export class ProductionWorkSessionContextProvider implements WorkSessionContextProvider {
  constructor(private readonly options: ProductionWorkSessionContextProviderOptions = {}) {}

  async getContext(input: {
    userId: string
    workSessionId: string
  }): Promise<{ workSession?: WorkSessionContext; limitations: string[] }> {
    const id = input.workSessionId.trim().slice(0, 200)
    if (!id) return { limitations: ["work session id was empty"] }

    const repository = this.options.repository ?? this.productionRepository(input.userId)
    if (!repository) {
      return { limitations: ["durable WorkSession storage is not configured"] }
    }

    const session = await repository.get(id)
    if (!session) {
      return { limitations: ["requested WorkSession was not found for the authenticated owner"] }
    }
    if (session.ownerUserId !== input.userId) {
      return { limitations: ["requested WorkSession did not belong to the authenticated owner"] }
    }

    const { redacted: goal, redactionCount } = redactSecrets(session.goal)
    const workSession = toContext(session, goal)
    const limitations: string[] = []
    if (redactionCount > 0) {
      limitations.push(\`\${redactionCount} secret-like pattern(s) redacted from WorkSession goal\`)
    }
    const excludedArtifacts = session.artifactRefs.filter((ref) => !ref.admitted).length
    if (excludedArtifacts > 0) {
      limitations.push(\`\${excludedArtifacts} non-admitted WorkSession artifact reference(s) remain identifiers only and are not model content\`)
    }

    return { workSession, limitations }
  }

  private productionRepository(userId: string): WorkSessionRepository | null {
    const client = createServiceRoleClient()
    return client ? new SupabaseWorkSessionRepository(client, userId) : null
  }
}

function toContext(session: JhadinaWorkSession, redactedGoal: string): WorkSessionContext {
  const activeSubsystems = [...session.activeSubsystems].slice(0, MAX_SUBSYSTEMS)
  const artifactRefs = session.artifactRefs.slice(0, MAX_ARTIFACT_REFS).map((ref) => ({ ...ref }))
  const decisionRefs = [...session.decisionRefs].slice(0, MAX_DECISION_REFS)
  const outputRefs = [...session.outputRefs].slice(0, MAX_OUTPUT_REFS)
  const evidence = [{
    id: \`work-session:\${session.id}\`,
    source: "work-session",
    observedAt: session.updatedAt,
    summary: [
      \`status=\${session.status}\`,
      \`goal=\${redactedGoal}\`,
      \`activeSubsystems=\${activeSubsystems.join(",") || "none"}\`,
      \`artifactRefs=\${artifactRefs.length}\`,
      \`decisionRefs=\${decisionRefs.length}\`,
      \`outputRefs=\${outputRefs.length}\`,
    ].join("; "),
    immutable: false,
  }]

  return {
    id: session.id,
    goal: redactedGoal,
    status: session.status,
    activeSubsystems,
    artifactRefs,
    decisionRefs,
    outputRefs,
    updatedAt: session.updatedAt,
    evidence,
  }
}

export function createProductionWorkSessionContextProvider(
  options: ProductionWorkSessionContextProviderOptions = {},
): ProductionWorkSessionContextProvider {
  return new ProductionWorkSessionContextProvider(options)
}
