import type {
  SocialAccount,
  SocialObservation,
  SocialOutboxJob,
  SocialPublicationProposal,
} from "@jhadina/social-core"
import { buildSocialLearningProjection } from "./learning"

export interface SocialHubItem {
  id: string
  source: "publication" | "observation"
  occurredAt: string
  platform?: string
  title: string
  status?: string
  contentId?: string
  provenance: string[]
}

export function buildSocialHub(input: {
  accounts: SocialAccount[]
  proposals: SocialPublicationProposal[]
  outbox: SocialOutboxJob[]
  observations: SocialObservation[]
}) {
  const items: SocialHubItem[] = [
    ...input.proposals.map((proposal) => ({
      id: proposal.id,
      source: "publication" as const,
      occurredAt: proposal.updatedAt,
      title: proposal.text.slice(0, 160),
      status: proposal.status,
      provenance: [
        `brand:${proposal.brand}`,
        `action:${proposal.actionId}`,
        ...proposal.targets.map((target) => `target:${target.provider}:${target.providerProfileId}`),
      ],
    })),
    ...input.observations.map((observation) => ({
      id: observation.id,
      source: "observation" as const,
      occurredAt: observation.observedAt,
      platform: observation.platform,
      title: observation.contentId ? `${observation.kind}: ${observation.contentId}` : observation.kind,
      contentId: observation.contentId,
      provenance: [`source:${observation.source}`, ...observation.evidence],
    })),
  ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))

  return {
    accounts: input.accounts,
    items,
    outbox: input.outbox,
    learning: input.observations
      .map(buildSocialLearningProjection)
      .filter((value) => value !== null),
  }
}
