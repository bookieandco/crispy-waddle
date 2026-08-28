import type { Opportunity as CanonicalOpportunity, OpportunitySourceType } from "@/../../../packages/growth-core/src/opportunity/domain/opportunity"
import type { Opportunity as LegacyOpportunity } from "./sideIncome"

const sourceType = (kind: LegacyOpportunity["kind"]): OpportunitySourceType => {
  switch (kind) {
    case "affiliate": return "affiliate"
    case "dropshipping": return "ecommerce"
    case "freelance":
    case "ai_job":
    case "remote_gig": return "service"
    case "creator": return "content"
    case "automation": return "local_business"
    case "overage": return "overage"
    case "pod": return "digital_product"
    default: return "market_intelligence"
  }
}

export function legacyToCanonicalOpportunity(item: LegacyOpportunity): CanonicalOpportunity {
  const now = item.approvedAt ?? item.createdAt
  const evidenceConfidence = item.sourceConfidence ?? 0
  const pay = item.estimatedPay

  return {
    id: item.id,
    userId: item.userId,
    title: item.title,
    description: item.summary,
    class: item.kind === "ai_job" || item.kind === "remote_gig" || item.kind === "freelance" ? "freelance" : "experiment",
    strategy: item.kind === "affiliate" ? "affiliate" : item.kind === "dropshipping" ? "ecommerce" : item.kind === "automation" ? "ai_service" : "digital_product",
    source: { type: sourceType(item.kind), name: item.sourceName, url: item.sourceUrl },
    evidence: [{ type: "source", summary: item.summary, sourceUrl: item.sourceUrl, confidence: evidenceConfidence }],
    economics: {
      currency: pay?.currency ?? "USD",
      estimatedRevenue: pay ? { min: pay.min, max: pay.max } : undefined,
      startupCost: item.startupCost,
      estimatedHours: item.estimatedHours,
    },
    score: { overall: item.fitScore, confidence: evidenceConfidence },
    status: item.status === "approved" ? "approved" : "discovered",
    deadline: item.deadline,
    requiresApproval: item.requiresUserApproval,
    createdAt: item.createdAt,
    updatedAt: now,
  }
}
