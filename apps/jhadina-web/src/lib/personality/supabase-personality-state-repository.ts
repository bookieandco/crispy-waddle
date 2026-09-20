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

function decodePersonalityState(value: unknown): PersonalityState {
  if (!isRecord(value)) throw new Error("Invalid persisted personality state")
  if (!Number.isInteger(value.version) || (value.version as number) < 0) {
    throw new Error("Invalid persisted personality version")
  }
  if (!Array.isArray(value.traits)) throw new Error("Invalid persisted personality traits")
  if (!isRecord(value.voice)) throw new Error("Invalid persisted personality voice")
  if (!isRecord(value.taste)) throw new Error("Invalid persisted personality taste")
  if (!isRecord(value.relationship)) {
    throw new Error("Invalid persisted personality relationship")
  }
  if (typeof value.independentAssessmentRequired !== "boolean") {
    throw new Error("Invalid persisted personality assessment flag")
  }
  if (typeof value.updatedAt !== "string" || Number.isNaN(Date.parse(value.updatedAt))) {
    throw new Error("Invalid persisted personality updatedAt")
  }
  return value as unknown as PersonalityState
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
