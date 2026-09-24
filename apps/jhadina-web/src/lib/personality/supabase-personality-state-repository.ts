import type { SupabaseClient } from "@supabase/supabase-js"
import {
  emptyPersonalityState,
  type PersonalityState,
  type PersonalityStateRepository,
} from "@jhadina/core-spine"
import { createServiceRoleClient } from "../supabase/service-role"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isUnit(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1
}

function isDateString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value))
}

function assertEvidence(value: unknown, label: string): void {
  if (!isRecord(value)) throw new Error(`Invalid persisted personality ${label}`)
  if (typeof value.id !== "string" || !value.id.trim()) throw new Error(`Invalid persisted personality ${label}.id`)
  if (typeof value.source !== "string" || !value.source.trim()) throw new Error(`Invalid persisted personality ${label}.source`)
  if (typeof value.summary !== "string" || !value.summary.trim()) throw new Error(`Invalid persisted personality ${label}.summary`)
  if (!isDateString(value.observedAt)) throw new Error(`Invalid persisted personality ${label}.observedAt`)
  if (value.immutable !== undefined && typeof value.immutable !== "boolean") {
    throw new Error(`Invalid persisted personality ${label}.immutable`)
  }
}

function assertEvidenceArray(value: unknown, label: string): void {
  if (!Array.isArray(value)) throw new Error(`Invalid persisted personality ${label}`)
  value.forEach((item, index) => assertEvidence(item, `${label}[${index}]`))
}

function assertUnitRecord(
  value: unknown,
  label: string,
  fields: readonly string[],
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`Invalid persisted personality ${label}`)
  for (const field of fields) {
    if (!isUnit(value[field])) throw new Error(`Invalid persisted personality ${label}.${field}`)
  }
}

const dimensions = new Set(["temperament", "communication", "preference", "tendency", "humor", "opinion", "taste", "relationship"])
const statuses = new Set(["candidate", "accepted", "contested", "retired"])

function assertTrait(value: unknown, index: number): void {
  const label = `traits[${index}]`
  if (!isRecord(value)) throw new Error(`Invalid persisted personality ${label}`)
  if (typeof value.id !== "string" || !value.id.trim()) throw new Error(`Invalid persisted personality ${label}.id`)
  if (typeof value.statement !== "string" || !value.statement.trim()) throw new Error(`Invalid persisted personality ${label}.statement`)
  if (value.sourcePatternId !== undefined && (typeof value.sourcePatternId !== "string" || !value.sourcePatternId.trim())) {
    throw new Error(`Invalid persisted personality ${label}.sourcePatternId`)
  }
  if (value.dimension !== undefined && (typeof value.dimension !== "string" || !dimensions.has(value.dimension))) {
    throw new Error(`Invalid persisted personality ${label}.dimension`)
  }
  if (!isUnit(value.confidence)) throw new Error(`Invalid persisted personality ${label}.confidence`)
  if (!isUnit(value.stability)) throw new Error(`Invalid persisted personality ${label}.stability`)
  if (typeof value.status !== "string" || !statuses.has(value.status)) throw new Error(`Invalid persisted personality ${label}.status`)
  assertEvidenceArray(value.evidence, `${label}.evidence`)
  assertEvidenceArray(value.contradictions, `${label}.contradictions`)
  if (value.firstObservedAt !== undefined && !isDateString(value.firstObservedAt)) throw new Error(`Invalid persisted personality ${label}.firstObservedAt`)
  if (value.lastObservedAt !== undefined && !isDateString(value.lastObservedAt)) throw new Error(`Invalid persisted personality ${label}.lastObservedAt`)
  if (value.revision !== undefined && (!Number.isInteger(value.revision) || (value.revision as number) < 0)) {
    throw new Error(`Invalid persisted personality ${label}.revision`)
  }
}

function decodePersonalityState(value: unknown): PersonalityState {
  if (!isRecord(value)) throw new Error("Invalid persisted personality state")
  if (!Number.isInteger(value.version) || (value.version as number) < 0) {
    throw new Error("Invalid persisted personality version")
  }

  if (!Array.isArray(value.traits)) throw new Error("Invalid persisted personality traits")
  value.traits.forEach(assertTrait)

  assertUnitRecord(value.voice, "voice", [
    "directness", "warmth", "humor", "profanityTolerance", "quipFrequency", "verbosity", "disagreementDirectness",
  ])
  if (value.expression !== undefined) {
    assertUnitRecord(value.expression, "expression", [
      "lyricality", "poeticCompression", "cadenceSpaciousness", "emotionalIntimacy",
      "relationalWarmth", "groundedConfidence", "resilienceHumor", "absurdEscalation",
      "callbackAffinity", "conceptualPlayfulness", "culturalFluency", "selfAuthorship",
      "gracefulRelease", "ordinaryEnchantment", "operationalSass", "affectionateTeasing",
      "protocolPushback",
    ])
    assertEvidenceArray(value.expression.evidence, "expression.evidence")
  }
  assertUnitRecord(value.taste, "taste", [
    "novelty", "experimentation", "conventionTolerance", "aestheticIntensity",
  ])
  assertEvidenceArray(value.taste.evidence, "taste.evidence")

  assertUnitRecord(value.relationship, "relationship", [
    "familiarity", "calibrationConfidence",
  ])
  if (!Array.isArray(value.relationship.preferredInteractionModes) || value.relationship.preferredInteractionModes.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error("Invalid persisted personality relationship.preferredInteractionModes")
  }
  if (!Array.isArray(value.relationship.recurringCallbacks) || value.relationship.recurringCallbacks.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error("Invalid persisted personality relationship.recurringCallbacks")
  }
  assertEvidenceArray(value.relationship.evidence, "relationship.evidence")

  if (typeof value.independentAssessmentRequired !== "boolean") {
    throw new Error("Invalid persisted personality assessment flag")
  }
  if (!isDateString(value.updatedAt)) {
    throw new Error("Invalid persisted personality updatedAt")
  }
  return structuredClone(value) as unknown as PersonalityState
}

export class SupabasePersonalityStateRepository implements PersonalityStateRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly profileId = "default",
  ) {}

  async load(): Promise<PersonalityState> {
    const { data, error } = await this.client
      .from("jhadina_personality_states")
      .select("state, version")
      .eq("profile_id", this.profileId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(`Failed to load personality state: ${error.message}`)
    if (!data) return emptyPersonalityState(new Date(0).toISOString())

    const state = decodePersonalityState(data.state)
    if (state.version !== data.version) {
      throw new Error("Persisted personality state version does not match row version")
    }
    return state
  }

  async save(expectedVersion: number, next: PersonalityState): Promise<void> {
    if (next.version !== expectedVersion + 1) {
      throw new Error("PersonalityStateRepository requires a strictly monotonic version")
    }

    const { error } = await this.client.rpc("jhadina_save_personality_state", {
      p_profile_id: this.profileId,
      p_expected_version: expectedVersion,
      p_next_state: next,
    })

    if (error) throw new Error(`Failed to persist personality state: ${error.message}`)
  }
}

/**
 * Production composition boundary. This adapter is server-only because it
 * uses the Supabase service-role key and therefore must never reach a client
 * component or browser bundle.
 */
export function createSupabasePersonalityStateRepository(
  profileId = "default",
): SupabasePersonalityStateRepository | null {
  const client = createServiceRoleClient()
  return client ? new SupabasePersonalityStateRepository(client, profileId) : null
}
