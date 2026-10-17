import {
  fingerprintSocialPublication,
  type ApprovedWeeklySocialCampaignPacket,
  type SocialPublicationProposal,
  type WeeklyDirectorProductionAction,
  type WeeklyOrganicPublicationAction,
} from "@jhadina/social-core";

export interface WeeklyDirectorApprovedOutput {
  id: string;
  briefId: string;
  socialContentProjectId: string;
  socialAssetId: string;
  directorProjectId: string;
  directorAssetId: string;
  uri: string;
  reviewDecisionId: string;
  reviewEvidenceIds: readonly string[];
  approvedAt: string;
  authority: "DIRECTOR_ASSET_APPROVED";
  publicationAuthority: "NONE";
}

export interface MaterializedWeeklyPublication {
  packetId: string;
  weeklyActionId: string;
  campaignId: string;
  ownerUserId: string;
  directorActionId?: string;
  directorReceiptId?: string;
  text: string;
  mediaUrls: readonly string[];
  scheduledAt: string;
  targetAccountId: string;
  requestFingerprint: string;
  evidenceRefs: readonly string[];
  authority: "WEEKLY_PUBLICATION_MATERIALIZED";
  publicationAuthority: "NONE";
}

export function materializeWeeklyOrganicPublication(input: {
  packet: ApprovedWeeklySocialCampaignPacket;
  action: WeeklyOrganicPublicationAction;
  directorReceipt?: WeeklyDirectorApprovedOutput;
}): MaterializedWeeklyPublication {
  const original = input.packet.actions.find((candidate) => candidate.id === input.action.id);
  if (!original || original.kind !== "organic_publication") {
    throw new Error("SOCIAL_WEEKLY_MATERIALIZATION_ACTION_NOT_IN_PACKET");
  }
  if (
    original.campaignId !== input.action.campaignId
    || original.brand !== input.action.brand
    || original.text !== input.action.text
    || original.scheduledAt !== input.action.scheduledAt
    || original.contentProjectRef !== input.action.contentProjectRef
    || original.contentAssetRef !== input.action.contentAssetRef
  ) {
    throw new Error("SOCIAL_WEEKLY_MATERIALIZATION_ACTION_MUTATED");
  }
  assertTargetEqual(original, input.action);

  let mediaUrls: readonly string[];
  let directorActionId: string | undefined;
  let directorReceiptId: string | undefined;
  const evidence = [...input.action.evidenceRefs];

  if (input.action.directorOutput) {
    const receipt = input.directorReceipt;
    if (!receipt) throw new Error("SOCIAL_WEEKLY_DIRECTOR_RECEIPT_REQUIRED");
    if (receipt.authority !== "DIRECTOR_ASSET_APPROVED" || receipt.publicationAuthority !== "NONE") {
      throw new Error("SOCIAL_WEEKLY_DIRECTOR_RECEIPT_AUTHORITY_INVALID");
    }
    if (!receipt.uri.trim() || !receipt.reviewEvidenceIds.length) {
      throw new Error("SOCIAL_WEEKLY_DIRECTOR_RECEIPT_EVIDENCE_REQUIRED");
    }
    if (!Number.isFinite(Date.parse(receipt.approvedAt))) {
      throw new Error("SOCIAL_WEEKLY_DIRECTOR_RECEIPT_TIME_INVALID");
    }

    const director = input.packet.actions.find(
      (candidate): candidate is WeeklyDirectorProductionAction =>
        candidate.kind === "director_production"
        && candidate.id === input.action.directorOutput!.directorActionId,
    );
    if (!director) throw new Error("SOCIAL_WEEKLY_DIRECTOR_ACTION_NOT_IN_PACKET");
    if (
      director.productionBriefRef !== input.action.directorOutput.productionBriefRef
      || director.socialContentProjectRef !== input.action.contentProjectRef
      || director.socialAssetRef !== input.action.contentAssetRef
    ) {
      throw new Error("SOCIAL_WEEKLY_DIRECTOR_SLOT_MISMATCH");
    }
    if (
      receipt.briefId !== director.productionBriefRef
      || receipt.socialContentProjectId !== director.socialContentProjectRef
      || receipt.socialAssetId !== director.socialAssetRef
      || receipt.directorProjectId !== director.directorProjectRef
    ) {
      throw new Error("SOCIAL_WEEKLY_DIRECTOR_RECEIPT_LINEAGE_MISMATCH");
    }

    mediaUrls = Object.freeze([receipt.uri]);
    directorActionId = director.id;
    directorReceiptId = receipt.id;
    evidence.push(
      "weekly-director-action:" + director.id,
      "director-receipt:" + receipt.id,
      "director-asset:" + receipt.directorAssetId,
      "director-review:" + receipt.reviewDecisionId,
      ...receipt.reviewEvidenceIds,
    );
  } else {
    if (input.directorReceipt) {
      throw new Error("SOCIAL_WEEKLY_UNEXPECTED_DIRECTOR_RECEIPT");
    }
    mediaUrls = Object.freeze([...input.action.mediaRefs]);
  }

  const requestFingerprint = fingerprintSocialPublication({
    brand: input.action.brand,
    text: input.action.text,
    mediaUrls,
    scheduledAt: input.action.scheduledAt,
    targets: [input.action.target],
  });

  return Object.freeze({
    packetId: input.packet.id,
    weeklyActionId: input.action.id,
    campaignId: input.action.campaignId,
    ownerUserId: input.packet.ownerUserId,
    directorActionId,
    directorReceiptId,
    text: input.action.text,
    mediaUrls,
    scheduledAt: input.action.scheduledAt,
    targetAccountId: input.action.target.accountId,
    requestFingerprint,
    evidenceRefs: Object.freeze(unique([
      ...evidence,
      "weekly-packet:" + input.packet.id,
      "weekly-approval:" + input.packet.approvalReceiptId,
    ])),
    authority: "WEEKLY_PUBLICATION_MATERIALIZED" as const,
    publicationAuthority: "NONE" as const,
  });
}

export function assertWeeklyPublicationProposalBinding(input: {
  packet: ApprovedWeeklySocialCampaignPacket;
  action: WeeklyOrganicPublicationAction;
  materialized: MaterializedWeeklyPublication;
  proposal: SocialPublicationProposal;
}): void {
  if (input.materialized.packetId !== input.packet.id) {
    throw new Error("SOCIAL_WEEKLY_PROPOSAL_PACKET_MISMATCH");
  }
  if (input.materialized.weeklyActionId !== input.action.id) {
    throw new Error("SOCIAL_WEEKLY_PROPOSAL_ACTION_MISMATCH");
  }
  const proposal = input.proposal;
  if (proposal.userId !== input.packet.ownerUserId) {
    throw new Error("SOCIAL_WEEKLY_PROPOSAL_OWNER_MISMATCH");
  }
  if (
    proposal.brand !== input.action.brand
    || proposal.text !== input.action.text
    || (proposal.scheduledAt ?? "") !== input.action.scheduledAt
    || proposal.requestFingerprint !== input.materialized.requestFingerprint
  ) {
    throw new Error("SOCIAL_WEEKLY_PROPOSAL_PAYLOAD_MISMATCH");
  }
  if (!sameStrings(proposal.mediaUrls, input.materialized.mediaUrls)) {
    throw new Error("SOCIAL_WEEKLY_PROPOSAL_MEDIA_MISMATCH");
  }
  if (proposal.targets.length !== 1) {
    throw new Error("SOCIAL_WEEKLY_PROPOSAL_EXACT_TARGET_REQUIRED");
  }
  const target = proposal.targets[0]!;
  if (
    target.accountId !== input.action.target.accountId
    || target.brand !== input.action.target.brand
    || target.provider !== input.action.target.provider
    || target.providerProfileId !== input.action.target.providerProfileId
    || target.platform !== input.action.target.platform
  ) {
    throw new Error("SOCIAL_WEEKLY_PROPOSAL_TARGET_MISMATCH");
  }
}

function assertTargetEqual(
  expected: WeeklyOrganicPublicationAction,
  actual: WeeklyOrganicPublicationAction,
): void {
  if (
    expected.target.accountId !== actual.target.accountId
    || expected.target.brand !== actual.target.brand
    || expected.target.provider !== actual.target.provider
    || expected.target.providerProfileId !== actual.target.providerProfileId
    || expected.target.platform !== actual.target.platform
  ) {
    throw new Error("SOCIAL_WEEKLY_MATERIALIZATION_TARGET_MUTATED");
  }
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
