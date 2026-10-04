import "server-only"

import { createHash } from "node:crypto"
import type {
  AffiliateNetworkObservation,
  AffiliateNetworkObservationAdapter,
  AffiliateNetworkReadBatch,
} from "@jhadina/commerce-adapters"
import {
  isSideHustleProfile,
  type SideHustleAffiliateEvent,
} from "@jhadina/opportunity-core"
import {
  recordSideHustleAffiliateEventRuntime,
  type SideHustleCommercePersistence,
} from "./side-hustle-commerce-runtime"

export type AffiliateNetworkSyncResult = {
  opportunityId: string
  provider: string
  accountRef: string
  pages: number
  observationsRead: number
  observationsPersisted: number
  eventIds: string[]
  nextCursor?: string
  complete: boolean
  externalActionAuthorized: false
  publishingAuthorized: false
  paymentAuthorized: false
  moneyMovementAuthorized: false
}

export async function syncAffiliateNetworkObservations(
  input: {
    opportunityId: string
    accountRef: string
    startAt?: string
    endAt?: string
    cursor?: string
    limit?: number
    maxPages?: number
  },
  adapter: AffiliateNetworkObservationAdapter,
  repository: SideHustleCommercePersistence,
): Promise<AffiliateNetworkSyncResult> {
  const opportunityId = requireText(input.opportunityId, "opportunityId")
  const accountRef = requireText(input.accountRef, "accountRef")
  const stored = await repository.get(opportunityId)
  if (!stored) throw new Error("AFFILIATE_NETWORK_SYNC_OPPORTUNITY_NOT_FOUND")
  const profile = stored.opportunity.metadata?.sideHustleProfile
  if (!isSideHustleProfile(profile) || profile.family !== "commerce_affiliate") {
    throw new Error("AFFILIATE_NETWORK_SYNC_REQUIRES_COMMERCE_AFFILIATE")
  }

  const maxPages = input.maxPages ?? 25
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100) {
    throw new Error("AFFILIATE_NETWORK_SYNC_MAX_PAGES_INVALID")
  }

  let cursor = input.cursor
  let pages = 0
  let observationsRead = 0
  let complete = false
  let nextCursor: string | undefined
  let provider = adapter.name
  let batchAccountRef = accountRef
  const events: SideHustleAffiliateEvent[] = []

  while (pages < maxPages) {
    const batch = await adapter.read({
      accountRef,
      startAt: input.startAt,
      endAt: input.endAt,
      cursor,
      limit: input.limit,
    })
    pages += 1
    provider = batch.provider
    batchAccountRef = batch.accountRef
    observationsRead += batch.observations.length

    if (batch.provider !== adapter.name) {
      throw new Error("AFFILIATE_NETWORK_SYNC_PROVIDER_MISMATCH")
    }

    for (const observation of batch.observations) {
      const event = await persistObservation(
        opportunityId,
        observation,
        repository,
      )
      events.push(event)
    }

    complete = batch.complete
    nextCursor = batch.nextCursor
    if (complete || !nextCursor) break
    cursor = nextCursor
  }

  return {
    opportunityId,
    provider,
    accountRef: batchAccountRef,
    pages,
    observationsRead,
    observationsPersisted: events.length,
    eventIds: [...new Set(events.map((event) => event.id))],
    nextCursor: complete ? undefined : nextCursor,
    complete,
    externalActionAuthorized: false,
    publishingAuthorized: false,
    paymentAuthorized: false,
    moneyMovementAuthorized: false,
  }
}

export function affiliateNetworkObservationId(
  observation: AffiliateNetworkObservation,
): string {
  const stateFingerprint = JSON.stringify({
    provider: observation.provider,
    accountRef: observation.accountRef,
    programRef: observation.programRef,
    externalEventRef: observation.externalEventRef,
    kind: observation.kind,
    providerStatus: observation.providerStatus ?? null,
    economicState: observation.economicState ?? null,
    amount: observation.amount ?? null,
    currency: observation.currency ?? null,
    occurredAt: observation.occurredAt,
  })
  const digest = createHash("sha256")
    .update(stateFingerprint)
    .digest("hex")
    .slice(0, 28)
  return `affiliate-network:${observation.provider}:${digest}`
}

async function persistObservation(
  opportunityId: string,
  observation: AffiliateNetworkObservation,
  repository: SideHustleCommercePersistence,
): Promise<SideHustleAffiliateEvent> {
  return recordSideHustleAffiliateEventRuntime(
    {
      opportunityId,
      id: affiliateNetworkObservationId(observation),
      programRef: observation.programRef,
      providerRef: `provider:${observation.provider}`,
      externalEventRef: observation.externalEventRef,
      kind: observation.kind,
      providerStatus: observation.providerStatus,
      economicState: observation.economicState,
      customerOrSessionRef: observation.customerOrSessionRef,
      amount: observation.amount,
      currency: observation.currency,
      evidenceRefs: observation.evidenceRefs,
      occurredAt: observation.occurredAt,
    },
    repository,
  )
}

export function latestAffiliateNetworkState(
  observations: AffiliateNetworkObservation[],
): AffiliateNetworkObservation[] {
  const latest = new Map<string, AffiliateNetworkObservation>()
  for (const observation of observations) {
    const existing = latest.get(observation.externalEventRef)
    if (
      !existing ||
      Date.parse(observation.occurredAt) > Date.parse(existing.occurredAt) ||
      (
        observation.occurredAt === existing.occurredAt &&
        stateRank(observation) > stateRank(existing)
      )
    ) {
      latest.set(observation.externalEventRef, observation)
    }
  }
  return [...latest.values()].sort(
    (a, b) =>
      Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
      a.externalEventRef.localeCompare(b.externalEventRef),
  )
}

function stateRank(observation: AffiliateNetworkObservation): number {
  switch (observation.economicState) {
    case "paid":
      return 5
    case "approved":
      return 4
    case "rejected":
      return 3
    case "pending":
      return 2
    default:
      return 1
  }
}

function requireText(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required`)
  }
  return value.trim()
}
