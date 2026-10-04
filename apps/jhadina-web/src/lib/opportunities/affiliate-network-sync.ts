import "server-only"

import { createHash } from "node:crypto"
import type {
  AffiliateNetworkObservation,
  AffiliateNetworkObservationAdapter,
  AffiliateNetworkReadBatch,
} from "@jhadina/commerce-adapters"
import type { SideHustleAffiliateEvent } from "@jhadina/opportunity-core"
import {
  recordSideHustleAffiliateEventRuntime,
  type SideHustleCommercePersistence,
} from "./side-hustle-commerce-runtime"

export type AffiliateNetworkSyncResult = {
  opportunityId: string
  provider: string
  accountRef: string
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
  },
  adapter: AffiliateNetworkObservationAdapter,
  repository: SideHustleCommercePersistence,
): Promise<AffiliateNetworkSyncResult> {
  const opportunityId = requireText(input.opportunityId, "opportunityId")
  const accountRef = requireText(input.accountRef, "accountRef")

  const batch = await adapter.read({
    accountRef,
    startAt: input.startAt,
    endAt: input.endAt,
    cursor: input.cursor,
    limit: input.limit,
  })

  const events: SideHustleAffiliateEvent[] = []
  for (const observation of batch.observations) {
    const event = await persistObservation(
      opportunityId,
      observation,
      repository,
    )
    events.push(event)
  }

  return {
    opportunityId,
    provider: batch.provider,
    accountRef: batch.accountRef,
    observationsRead: batch.observations.length,
    observationsPersisted: events.length,
    eventIds: events.map((event) => event.id),
    nextCursor: batch.nextCursor,
    complete: batch.complete,
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
    externalEventRef: observation.externalEventRef,
    kind: observation.kind,
    providerStatus: observation.providerStatus ?? null,
    economicState: observation.economicState ?? null,
    amount: observation.amount ?? null,
    currency: observation.currency ?? null,
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
