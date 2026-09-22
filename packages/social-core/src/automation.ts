import type { SocialPublicationProposal, SocialPublishTarget } from "./types.js";

export interface ApprovedScheduledPublication {
  proposalId: string;
  approvalReceiptId: string;
  requestFingerprint: string;
  scheduledAt: string;
  target: SocialPublishTarget;
  text: string;
  mediaUrls: readonly string[];
}

export interface SocialAutomationManifest {
  id: string;
  createdAt: string;
  entries: readonly ApprovedScheduledPublication[];
}

/**
 * Builds an automation manifest only from already-approved, immutable publication proposals.
 * It never creates content, expands targets, or grants publish authority.
 */
export function buildSocialAutomationManifest(
  id: string,
  proposals: readonly SocialPublicationProposal[],
  now = new Date(),
): SocialAutomationManifest {
  if (!id.trim()) throw new Error("SOCIAL_AUTOMATION_ID_REQUIRED");
  const entries: ApprovedScheduledPublication[] = [];

  for (const proposal of proposals) {
    if (proposal.status !== "approved" && proposal.status !== "queued") {
      throw new Error("SOCIAL_AUTOMATION_REQUIRES_APPROVED_PROPOSAL");
    }
    if (!proposal.approvalReceiptId) throw new Error("SOCIAL_AUTOMATION_APPROVAL_RECEIPT_REQUIRED");
    if (!proposal.scheduledAt || !Number.isFinite(Date.parse(proposal.scheduledAt))) {
      throw new Error("SOCIAL_AUTOMATION_SCHEDULE_REQUIRED");
    }
    if (Date.parse(proposal.scheduledAt) <= now.getTime()) {
      throw new Error("SOCIAL_AUTOMATION_SCHEDULE_MUST_BE_FUTURE");
    }
    if (proposal.targets.length !== 1) {
      throw new Error("SOCIAL_AUTOMATION_EXACT_TARGET_REQUIRED");
    }
    const target = proposal.targets[0];
    entries.push(Object.freeze({
      proposalId: proposal.id,
      approvalReceiptId: proposal.approvalReceiptId,
      requestFingerprint: proposal.requestFingerprint,
      scheduledAt: proposal.scheduledAt,
      target: Object.freeze({ ...target }),
      text: proposal.text,
      mediaUrls: Object.freeze([...proposal.mediaUrls]),
    }));
  }

  entries.sort((a, b) =>
    Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)
    || a.proposalId.localeCompare(b.proposalId),
  );

  return Object.freeze({
    id,
    createdAt: now.toISOString(),
    entries: Object.freeze(entries),
  });
}

export function nextAutomationEntries(
  manifest: SocialAutomationManifest,
  at: Date,
  lookaheadMs = 5 * 60 * 1000,
): readonly ApprovedScheduledPublication[] {
  if (!Number.isFinite(lookaheadMs) || lookaheadMs < 0) {
    throw new Error("SOCIAL_AUTOMATION_LOOKAHEAD_INVALID");
  }
  const end = at.getTime() + lookaheadMs;
  return Object.freeze(
    manifest.entries.filter((entry) => {
      const timestamp = Date.parse(entry.scheduledAt);
      return timestamp >= at.getTime() && timestamp <= end;
    }),
  );
}
