import { describe, expect, it } from "vitest"
import type {
  AffiliateNetworkObservationAdapter,
  AffiliateNetworkReadBatch,
} from "@jhadina/commerce-adapters"
import {
  buildSideHustleProfile,
  type Opportunity,
  type SideHustleCommerceRecord,
  type SideHustleCommerceRecordKind,
} from "@jhadina/opportunity-core"
import type { StoredCanonicalOpportunity } from "./canonical"
import type { StoredSideHustleCommerceRecord } from "./supabase-opportunity-repository"
import {
  affiliateNetworkObservationId,
  latestAffiliateNetworkState,
  syncAffiliateNetworkObservations,
} from "./affiliate-network-sync"
import type { SideHustleCommercePersistence } from "./side-hustle-commerce-runtime"

const now = "2026-10-03T14:30:00.000Z"

function fixture() {
  const opportunity: Opportunity = {
    id: "opportunity:affiliate",
    title: "Affiliate fixture",
    family: "business",
    type: "commercial",
    sourceName: "fixture",
    sourceUrl: "https://example.test",
    claims: [],
    evidence: [],
    verificationStatus: "unverified",
    sourceConfidence: 0.9,
    riskFlags: [],
    metadata: {
      sideHustleProfile: buildSideHustleProfile({
        family: "commerce_affiliate",
      }),
    },
    status: "ready",
    createdAt: now,
    updatedAt: now,
  }
  const stored: StoredCanonicalOpportunity = {
    userId: "owner:test",
    opportunity,
    triageState: "saved",
  }
  const records = new Map<string, StoredSideHustleCommerceRecord>()
  const repository: SideHustleCommercePersistence = {
    async get(id) {
      return id === opportunity.id ? stored : undefined
    },
    async getSideHustleCommerceRecord(id) {
      return records.get(id)
    },
    async listSideHustleCommerceRecords() {
      return [...records.values()]
    },
    async saveSideHustleCommerceRecord(kind, record) {
      const existing = records.get(record.id)
      if (existing) return existing.payload
      records.set(record.id, {
        id: record.id,
        opportunityId: record.opportunityId,
        family: record.family,
        kind,
        status: "status" in record ? String(record.status) : undefined,
        payload: structuredClone(record) as SideHustleCommerceRecord,
        recordedAt:
          kind === "affiliate_event"
            ? (record as any).occurredAt
            : now,
      })
      return record
    },
  }
  return { repository, records }
}

describe("affiliate network sync", () => {
  it("deduplicates the same provider state while preserving later state changes", async () => {
    const pending = {
      provider: "cj-affiliate",
      accountRef: "cj:publisher:300",
      programRef: "cj:advertiser:200",
      externalEventRef: "cj:commission:100",
      kind: "conversion" as const,
      providerStatus: "NEW:PENDING",
      economicState: "pending" as const,
      amount: 25,
      currency: "USD",
      occurredAt: "2026-10-03T12:00:00Z",
      evidenceRefs: ["cj:commission:100"],
    }
    const approved = {
      ...pending,
      providerStatus: "LOCKED:ACCEPTED",
      economicState: "approved" as const,
    }

    expect(affiliateNetworkObservationId(pending)).not.toBe(
      affiliateNetworkObservationId(approved),
    )

    const f = fixture()
    let state: "pending" | "approved" = "pending"
    const adapter: AffiliateNetworkObservationAdapter = {
      name: "cj-affiliate",
      async read(): Promise<AffiliateNetworkReadBatch> {
        return {
          provider: "cj-affiliate",
          accountRef: "300",
          observations: [state === "pending" ? pending : approved],
          complete: true,
          readOnly: true,
        }
      },
    }

    await syncAffiliateNetworkObservations(
      { opportunityId: "opportunity:affiliate", accountRef: "300" },
      adapter,
      f.repository,
    )
    await syncAffiliateNetworkObservations(
      { opportunityId: "opportunity:affiliate", accountRef: "300" },
      adapter,
      f.repository,
    )
    expect(f.records.size).toBe(1)

    state = "approved"
    await syncAffiliateNetworkObservations(
      { opportunityId: "opportunity:affiliate", accountRef: "300" },
      adapter,
      f.repository,
    )
    expect(f.records.size).toBe(2)
  })

  it("selects the strongest state when provider timestamps are equal", () => {
    const base = {
      provider: "partnerize",
      accountRef: "partnerize:publisher:p1",
      programRef: "partnerize:campaign:c1",
      externalEventRef: "partnerize:conversion:x1",
      kind: "conversion" as const,
      amount: 10,
      currency: "USD",
      occurredAt: "2026-10-03T12:00:00Z",
      evidenceRefs: ["evidence:x1"],
    }
    const latest = latestAffiliateNetworkState([
      { ...base, economicState: "pending" },
      { ...base, economicState: "approved" },
    ])
    expect(latest).toHaveLength(1)
    expect(latest[0].economicState).toBe("approved")
  })
})
