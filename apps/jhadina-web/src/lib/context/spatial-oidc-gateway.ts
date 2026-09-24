import { headers } from "next/headers"
import type {
  RealityAdmission,
  SpatialEvidence,
  SpatialEvidenceStore,
  SpatialGraphContribution,
  SpatialKnowledgeSink,
  SpatialRealityCandidate,
  SpatialRealityStore,
} from "@jhadina/spatial-intelligence-core"

const DEFAULT_GATEWAY_URL =
  "https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-spatial-gateway"

type GatewayOptions = {
  endpoint?: string
  tokenProvider?: () => string | undefined | Promise<string | undefined>
  fetchImpl?: typeof fetch
}

type GatewayEnvelope<T> = { data?: T; error?: string }

async function defaultWorkloadOidcToken(): Promise<string | undefined> {
  const explicit = process.env.SPATIAL_WORKLOAD_OIDC_TOKEN?.trim()
  if (explicit) return explicit

  const vercel = process.env.VERCEL_OIDC_TOKEN?.trim()
  if (vercel) return vercel

  try {
    const requestHeaders = await headers()
    return requestHeaders.get("x-vercel-oidc-token")?.trim() || undefined
  } catch {
    return undefined
  }
}

export function spatialOidcGatewayAvailable(): boolean {
  return Boolean(
    process.env.SPATIAL_WORKLOAD_OIDC_TOKEN?.trim()
    || process.env.VERCEL_OIDC_TOKEN?.trim()
    || process.env.VERCEL === "1",
  )
}

export class SpatialOidcGatewayClient {
  private readonly endpoint: string
  private readonly tokenProvider: () => string | undefined | Promise<string | undefined>
  private readonly fetchImpl: typeof fetch

  constructor(options: GatewayOptions = {}) {
    this.endpoint =
      options.endpoint
      ?? process.env.JHADINA_SPATIAL_GATEWAY_URL?.trim()
      ?? DEFAULT_GATEWAY_URL
    this.tokenProvider = options.tokenProvider ?? defaultWorkloadOidcToken
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  private async call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
    const token = await this.tokenProvider()
    if (!token) throw new Error("JHADINA_SPATIAL_WORKLOAD_OIDC_REQUIRED")

    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ action, payload }),
      cache: "no-store",
    })

    let body: GatewayEnvelope<T>
    try {
      body = await response.json() as GatewayEnvelope<T>
    } catch {
      throw new Error(`JHADINA_SPATIAL_GATEWAY_FAILED:${action}:invalid_json`)
    }
    if (!response.ok) {
      throw new Error(
        `JHADINA_SPATIAL_GATEWAY_FAILED:${action}:${response.status}:${body.error ?? "unknown"}`,
      )
    }
    return body.data as T
  }

  async probe(): Promise<{
    evidence: boolean
    realityCandidates: boolean
    realityAdmissions: boolean
    knowledgeNodes: boolean
    knowledgeRelations: boolean
  }> {
    return this.call("probe")
  }

  evidenceStore(): SpatialEvidenceStore {
    return {
      append: async (evidence: SpatialEvidence) =>
        this.call<"APPENDED" | "DUPLICATE">("appendEvidence", { evidence }),
      get: async (evidenceId: string) =>
        (await this.call<SpatialEvidence | null>("getEvidence", { evidenceId })) ?? undefined,
    }
  }

  knowledgeSink(): SpatialKnowledgeSink {
    return {
      persist: async (contribution: SpatialGraphContribution) =>
        this.call<{ nodes: number; relations: number }>("persistKnowledge", { contribution }),
    }
  }

  realityStore(): SpatialRealityStore {
    return {
      appendCandidate: async (candidate: SpatialRealityCandidate) =>
        this.call<"APPENDED" | "DUPLICATE">("appendCandidate", { candidate }),
      appendAdmission: async (admission: RealityAdmission) =>
        this.call<"APPENDED" | "DUPLICATE">("appendAdmission", { admission }),
      getCandidate: async (candidateId: string) =>
        (await this.call<SpatialRealityCandidate | null>("getCandidate", { candidateId })) ?? undefined,
      getAdmissions: async (candidateId: string) =>
        this.call<RealityAdmission[]>("getAdmissions", { candidateId }),
    }
  }
}

export function createSpatialOidcGatewayClient(
  options: GatewayOptions = {},
): SpatialOidcGatewayClient | undefined {
  if (!options.tokenProvider && !spatialOidcGatewayAvailable()) return undefined
  return new SpatialOidcGatewayClient(options)
}

export const createOidcSpatialEvidenceStore = (
  options: GatewayOptions = {},
): SpatialEvidenceStore | undefined => createSpatialOidcGatewayClient(options)?.evidenceStore()

export const createOidcSpatialKnowledgeSink = (
  options: GatewayOptions = {},
): SpatialKnowledgeSink | undefined => createSpatialOidcGatewayClient(options)?.knowledgeSink()

export const createOidcSpatialRealityStore = (
  options: GatewayOptions = {},
): SpatialRealityStore | undefined => createSpatialOidcGatewayClient(options)?.realityStore()
