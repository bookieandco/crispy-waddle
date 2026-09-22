import type { SocialPublicationProposal, SocialPublishTarget } from "./types.js";

export interface SocialCalendarBatchEntry {
  proposalId: string;
  approvalReceiptId: string;
  requestFingerprint: string;
  scheduledAt: string;
  target: SocialPublishTarget;
}

export interface SocialCalendarBatch {
  id: string;
  createdAt: string;
  fingerprint: string;
  entries: readonly SocialCalendarBatchEntry[];
}

export function buildSocialCalendarBatch(
  id: string,
  proposals: readonly SocialPublicationProposal[],
  now = new Date(),
): SocialCalendarBatch {
  if (!id.trim()) throw new Error("SOCIAL_CALENDAR_BATCH_ID_REQUIRED");
  if (!proposals.length) throw new Error("SOCIAL_CALENDAR_BATCH_EMPTY");

  const seen = new Set<string>();
  const entries: SocialCalendarBatchEntry[] = [];

  for (const proposal of proposals) {
    if (seen.has(proposal.id)) throw new Error("SOCIAL_CALENDAR_DUPLICATE_PROPOSAL");
    seen.add(proposal.id);

    if (proposal.status !== "pending_approval") {
      throw new Error("SOCIAL_CALENDAR_PROPOSAL_NOT_PENDING");
    }
    if (!proposal.approvalReceiptId) {
      throw new Error("SOCIAL_CALENDAR_APPROVAL_RECEIPT_REQUIRED");
    }
    if (!proposal.scheduledAt || !Number.isFinite(Date.parse(proposal.scheduledAt))) {
      throw new Error("SOCIAL_CALENDAR_SCHEDULE_REQUIRED");
    }
    if (Date.parse(proposal.scheduledAt) <= now.getTime()) {
      throw new Error("SOCIAL_CALENDAR_SCHEDULE_MUST_BE_FUTURE");
    }
    if (proposal.targets.length !== 1) {
      throw new Error("SOCIAL_CALENDAR_EXACT_TARGET_REQUIRED");
    }

    entries.push(Object.freeze({
      proposalId: proposal.id,
      approvalReceiptId: proposal.approvalReceiptId,
      requestFingerprint: proposal.requestFingerprint,
      scheduledAt: proposal.scheduledAt,
      target: Object.freeze({ ...proposal.targets[0] }),
    }));
  }

  entries.sort((a, b) =>
    Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)
    || a.proposalId.localeCompare(b.proposalId),
  );

  return Object.freeze({
    id,
    createdAt: now.toISOString(),
    fingerprint: fingerprintEntries(entries),
    entries: Object.freeze(entries),
  });
}

export function assertSocialCalendarBatchCurrent(
  batch: SocialCalendarBatch,
  proposals: readonly SocialPublicationProposal[],
): void {
  const rebuilt = buildSocialCalendarBatch(batch.id, proposals, new Date(batch.createdAt));
  if (rebuilt.fingerprint !== batch.fingerprint) {
    throw new Error("SOCIAL_CALENDAR_BATCH_MUTATED");
  }
}

export function fingerprintSocialCalendarBatch(batch: SocialCalendarBatch): string {
  return batch.fingerprint;
}

function fingerprintEntries(entries: readonly SocialCalendarBatchEntry[]): string {
  return JSON.stringify({
    v: 1,
    entries: entries.map((entry) => ({
      proposalId: entry.proposalId,
      approvalReceiptId: entry.approvalReceiptId,
      requestFingerprint: entry.requestFingerprint,
      scheduledAt: entry.scheduledAt,
      target: {
        accountId: entry.target.accountId,
        brand: entry.target.brand,
        provider: entry.target.provider,
        providerProfileId: entry.target.providerProfileId,
        platform: entry.target.platform,
      },
    })),
  });
}
