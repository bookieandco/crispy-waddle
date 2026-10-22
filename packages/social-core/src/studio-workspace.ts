import type { JhadinaBrand, SocialAccount } from "./types.js";
import type { RelayBrandBrief, RelayCalendarSlot, RelayDraft } from "./relay-workbench.js";

/**
 * Owner-authored planning state only. Not a publication proposal, approved
 * Action Core receipt, canonical Director media asset, or verified account grant.
 */
export interface SocialStudioWorkspace {
  brief: RelayBrandBrief;
  drafts: readonly RelayDraft[];
  slots: readonly RelayCalendarSlot[];
}

function required(value: unknown, code: string, max = 6000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(code);
  return value;
}
function date(value: unknown, code: string): void {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error(code);
}

/** Strict owner+brand admission, never a permission to publish. */
export function validateSocialStudioWorkspace(
  value: SocialStudioWorkspace,
  ownerUserId: string,
  brand: JhadinaBrand,
  accounts: readonly SocialAccount[],
): SocialStudioWorkspace {
  if (!value || typeof value !== "object" || !value.brief ||
      !Array.isArray(value.drafts) || !Array.isArray(value.slots)) {
    throw new Error("SOCIAL_STUDIO_WORKSPACE_INVALID");
  }
  const { brief, drafts, slots } = value;
  if (brief.ownerUserId !== ownerUserId || brief.brand !== brand) {
    throw new Error("SOCIAL_STUDIO_WORKSPACE_OWNER_BRAND_MISMATCH");
  }
  required(brief.id, "SOCIAL_STUDIO_BRIEF_ID_REQUIRED");
  required(brief.positioning, "SOCIAL_STUDIO_BRIEF_REQUIRED");
  required(brief.audience, "SOCIAL_STUDIO_BRIEF_REQUIRED");
  required(brief.offer, "SOCIAL_STUDIO_BRIEF_REQUIRED");
  required(brief.siteUrl, "SOCIAL_STUDIO_URL_REQUIRED");
  date(brief.createdAt, "SOCIAL_STUDIO_DATE_INVALID");
  if (brief.provenance !== "owner_supplied" ||
      !Array.isArray(brief.evidenceRefs) || !brief.evidenceRefs.length ||
      !Array.isArray(brief.keywords) || brief.keywords.length > 20) {
    throw new Error("SOCIAL_STUDIO_BRIEF_EVIDENCE_INVALID");
  }
  if (drafts.length > 30 || slots.length > 30) throw new Error("SOCIAL_STUDIO_BATCH_LIMIT");
  const ids = new Set<string>();
  for (const draft of drafts) {
    required(draft.id, "SOCIAL_STUDIO_DRAFT_ID_REQUIRED");
    if (ids.has(draft.id)) throw new Error("SOCIAL_STUDIO_DUPLICATE_DRAFT");
    ids.add(draft.id);
    if (draft.brandBriefId !== brief.id || draft.project?.brand !== brand ||
        draft.project?.id !== draft.id + ":project" ||
        draft.project.assets?.[0]?.id !== draft.id + ":anchor" ||
        draft.project.assets[0].platform !== draft.platform ||
        !Array.isArray(draft.evidenceRefs) || !draft.evidenceRefs.length ||
        !Array.isArray(draft.storyboard) || draft.storyboard.length > 10) {
      throw new Error("SOCIAL_STUDIO_DRAFT_LINEAGE_INVALID");
    }
    required(draft.caption, "SOCIAL_STUDIO_CAPTION_REQUIRED", 6000);
    required(draft.hook, "SOCIAL_STUDIO_HOOK_REQUIRED", 6000);
    if (!["draft", "rejected", "accepted_for_planning"].includes(draft.review)) {
      throw new Error("SOCIAL_STUDIO_REVIEW_INVALID");
    }
    if (draft.review !== "draft") {
      if (draft.reviewerId !== ownerUserId) throw new Error("SOCIAL_STUDIO_REVIEW_OWNER_MISMATCH");
      date(draft.reviewedAt, "SOCIAL_STUDIO_REVIEW_DATE_INVALID");
    } else if (draft.reviewerId || draft.reviewedAt) {
      throw new Error("SOCIAL_STUDIO_UNREVIEWED_STATE_INVALID");
    }
  }
  const slotIds = new Set<string>();
  for (const slot of slots) {
    if (slotIds.has(slot.id)) throw new Error("SOCIAL_STUDIO_DUPLICATE_SLOT");
    slotIds.add(slot.id);
    const draft = drafts.find((item) => item.id === slot.draftId);
    if (!draft || draft.review !== "accepted_for_planning" ||
        slot.id !== "relay-slot:" + draft.id ||
        slot.ownerUserId !== ownerUserId || slot.brand !== brand ||
        slot.platform !== draft.platform ||
        slot.requiresCanonicalPublicationApproval !== true || slot.isQueued !== false) {
      throw new Error("SOCIAL_STUDIO_SLOT_IS_NOT_PERMISSION");
    }
    date(slot.scheduledAt, "SOCIAL_STUDIO_SCHEDULE_INVALID");
    const account = accounts.find((a) => a.id === slot.accountId);
    if (!account || account.userId !== ownerUserId || account.brand !== brand ||
        account.platform !== slot.platform || account.status !== "connected") {
      throw new Error("SOCIAL_STUDIO_SLOT_ACCOUNT_MISMATCH");
    }
  }
  return value;
}
