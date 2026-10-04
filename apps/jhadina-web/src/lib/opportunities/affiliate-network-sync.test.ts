import { describe, expect, it } from "vitest"
import type {
  AffiliateNetworkObservationAdapter,
  AffiliateNetworkReadBatch,
} from "@jhadina/commerce-adapters"
import {
  buildSideHustleProfile,
  type Opportunity,
  type SideHustleCommerceRecord,
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

function fixture(family: "commerce_affiliate" | "digital_products" = "commerce_affiliate") {
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
      sideHustleProfile: buildSideHustleProfile({ family }),
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

  it("pages through provider cursors in one sync run", async () => {
    const f = fixture()
    let page = 0
    const cursors: Array<string | undefined> = []
    const adapter: AffiliateNetworkObservationAdapter = {
      name: "fixture-network",
      async read(input): Promise<AffiliateNetworkReadBatch> {
        cursors.push(input.cursor)
        page += 1
        return {
          provider: "fixture-network",
          accountRef: input.accountRef,
          observations: [{
            provider: "fixture-network",
            accountRef: input.accountRef,
            programRef: "program:1",
            externalEventRef: `event:${page}`,
            kind: "conversion",
            economicState: "pending",
            amount: 5,
            currency: "USD",
            occurredAt: `2026-10-03T12:0${page}:00Z`,
            evidenceRefs: [`evidence:${page}`],
          }],
          nextCursor: page === 1 ? "cursor:2" : undefined,
          complete: page !== 1,
          readOnly: true,
        }
      },
    }

    const result = await syncAffiliateNetworkObservations(
      {
        opportunityId: "opportunity:affiliate",
        accountRef: "publisher:1",
        maxPages: 10,
      },
      adapter,
      f.repository,
    )

    expect(result.pages).toBe(2)
    expect(result.complete).toBe(true)
    expect(result.observationsRead).toBe(2)
    expect(cursors).toEqual([undefined, "cursor:2"])
    expect(f.records.size).toBe(2)
  })

  it("refuses provider reads for non-affiliate opportunities", async () => {
    const f = fixture("digital_products")
    let read = false
    const adapter: AffiliateNetworkObservationAdapter = {
      name: "fixture-network",
      async read(): Promise<AffiliateNetworkReadBatch> {
        read = true
        return {
          provider: "fixture-network",
          accountRef: "publisher:1",
          observations: [],
          complete: true,
          readOnly: true,
        }
      },
    }

    await expect(syncAffiliateNetworkObservations(
      { opportunityId: "opportunity:affiliate", accountRef: "publisher:1" },
      adapter,
      f.repository,
    )).rejects.toThrow("AFFILIATE_NETWORK_SYNC_REQUIRES_COMMERCE_AFFILIATE")
    expect(read).toBe(false)
  })

  it("prefers rejection over approval when provider timestamps are equal", () => {
    const base = {
      provider: "partnerize",
      accountRef: "partnerize:publisher:p1",
      programRef: "partnerize:campaign:c1",
      externalEventRef: "partnerize:conversion:rejected",
      kind: "conversion" as const,
      amount: 10,
      currency: "USD",
      occurredAt: "2026-10-03T12:00:00Z",
      evidenceRefs: ["evidence:rejected"],
    }
    const latest = latestAffiliateNetworkState([
      { ...base, economicState: "approved" },
      { ...base, economicState: "rejected" },
    ])
    expect(latest).toHaveLength(1)
    expect(latest[0].economicState).toBe("rejected")
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
