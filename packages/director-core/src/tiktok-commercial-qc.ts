import {
  evaluateProductCreativeRepresentation,
  type ProductCreativeRepresentation,
  type ProductTruthLock,
} from "./product-truth-lock.js";

export type TikTokCommercialOfferEvidence = {
  offerRef: string;
  productRef: string;
  state: "active" | "inactive" | "unknown";
  validFrom?: string;
  validUntil?: string;
  evidenceIds: readonly string[];
};

export type TikTokCommercialClaimEvidence = {
  claimRef: string;
  text: string;
  productRef: string;
  evidenceIds: readonly string[];
  expiresAt?: string;
};

export type TikTokCommercialQcInput = {
  id: string;
  productRef: string;
  truthLock: ProductTruthLock;
  representations: readonly ProductCreativeRepresentation[];
  claims: readonly TikTokCommercialClaimEvidence[];
  offers: readonly TikTokCommercialOfferEvidence[];
  referencedOfferRefs: readonly string[];
  rightsEvidenceIds: readonly string[];
  sourceEvidenceIds: readonly string[];
  aiEdited: boolean;
  aiDisclosurePresent: boolean;
  syntheticPersonDepicted: boolean;
  syntheticPersonDisclosurePresent: boolean;
  commercialDisclosurePresent: boolean;
  evaluatedAt: string;
};

export type TikTokCommercialQcResult = {
  id: string;
  productRef: string;
  status: "pass" | "blocked";
  reasons: readonly string[];
  truthMatchedAssertionRefs: readonly string[];
  approvedClaimRefs: readonly string[];
  approvedOfferRefs: readonly string[];
  evidenceIds: readonly string[];
  evaluatedAt: string;
  publicationAuthorized: false;
  moneyMovementAuthorized: false;
};

export function evaluateTikTokCommercialQc(
  input: TikTokCommercialQcInput,
): TikTokCommercialQcResult {
  requireText(input.id, "TIKTOK_QC_ID_REQUIRED");
  requireText(input.productRef, "TIKTOK_QC_PRODUCT_REQUIRED");
  requireDate(input.evaluatedAt, "TIKTOK_QC_EVALUATED_AT_INVALID");
  if (input.truthLock.productId !== input.productRef) {
    throw new Error("TIKTOK_QC_TRUTH_LOCK_PRODUCT_MISMATCH");
  }

  const reasons: string[] = [];
  const truth = evaluateProductCreativeRepresentation({
    lock: input.truthLock,
    representations: input.representations,
  });
  reasons.push(...truth.reasons);

  if (!input.rightsEvidenceIds.length) reasons.push("TIKTOK_QC_RIGHTS_EVIDENCE_REQUIRED");
  if (!input.sourceEvidenceIds.length) reasons.push("TIKTOK_QC_SOURCE_EVIDENCE_REQUIRED");
  if (!input.commercialDisclosurePresent) {
    reasons.push("TIKTOK_QC_COMMERCIAL_DISCLOSURE_REQUIRED");
  }
  if (input.aiEdited && !input.aiDisclosurePresent) {
    reasons.push("TIKTOK_QC_AI_DISCLOSURE_REQUIRED");
  }
  if (input.syntheticPersonDepicted && !input.syntheticPersonDisclosurePresent) {
    reasons.push("TIKTOK_QC_SYNTHETIC_PERSON_DISCLOSURE_REQUIRED");
  }

  const now = Date.parse(input.evaluatedAt);
  const approvedClaimRefs: string[] = [];
  for (const claim of input.claims) {
    requireClaim(claim);
    if (claim.productRef !== input.productRef) {
      reasons.push(`TIKTOK_QC_CLAIM_PRODUCT_MISMATCH:${claim.claimRef}`);
      continue;
    }
    if (claim.expiresAt && now > Date.parse(claim.expiresAt)) {
      reasons.push(`TIKTOK_QC_CLAIM_EXPIRED:${claim.claimRef}`);
      continue;
    }
    approvedClaimRefs.push(claim.claimRef);
  }

  const offers = new Map(input.offers.map((offer) => {
    requireOffer(offer);
    return [offer.offerRef, offer] as const;
  }));
  const approvedOfferRefs: string[] = [];
  for (const offerRef of input.referencedOfferRefs) {
    const offer = offers.get(offerRef);
    if (!offer) {
      reasons.push(`TIKTOK_QC_OFFER_EVIDENCE_MISSING:${offerRef}`);
      continue;
    }
    if (offer.productRef !== input.productRef) {
      reasons.push(`TIKTOK_QC_OFFER_PRODUCT_MISMATCH:${offerRef}`);
      continue;
    }
    if (offer.state !== "active") {
      reasons.push(
        offer.state === "unknown"
          ? `TIKTOK_QC_OFFER_STATE_UNKNOWN:${offerRef}`
          : `TIKTOK_QC_OFFER_INACTIVE:${offerRef}`,
      );
      continue;
    }
    if (offer.validFrom && now < Date.parse(offer.validFrom)) {
      reasons.push(`TIKTOK_QC_OFFER_NOT_STARTED:${offerRef}`);
      continue;
    }
    if (offer.validUntil && now > Date.parse(offer.validUntil)) {
      reasons.push(`TIKTOK_QC_OFFER_EXPIRED:${offerRef}`);
      continue;
    }
    approvedOfferRefs.push(offerRef);
  }

  const evidenceIds = unique([
    ...input.truthLock.evidenceIds,
    ...input.rightsEvidenceIds,
    ...input.sourceEvidenceIds,
    ...input.claims.flatMap((claim) => claim.evidenceIds),
    ...input.offers.flatMap((offer) => offer.evidenceIds),
  ]);

  if (!evidenceIds.length) reasons.push("TIKTOK_QC_EVIDENCE_REQUIRED");

  return Object.freeze({
    id: input.id,
    productRef: input.productRef,
    status: reasons.length === 0 ? "pass" : "blocked",
    reasons: Object.freeze(unique(reasons)),
    truthMatchedAssertionRefs: Object.freeze([...truth.matchedAssertionRefs]),
    approvedClaimRefs: Object.freeze(unique(approvedClaimRefs)),
    approvedOfferRefs: Object.freeze(unique(approvedOfferRefs)),
    evidenceIds: Object.freeze(evidenceIds),
    evaluatedAt: input.evaluatedAt,
    publicationAuthorized: false as const,
    moneyMovementAuthorized: false as const,
  });
}

function requireClaim(claim: TikTokCommercialClaimEvidence): void {
  requireText(claim.claimRef, "TIKTOK_QC_CLAIM_REF_REQUIRED");
  requireText(claim.text, "TIKTOK_QC_CLAIM_TEXT_REQUIRED");
  requireText(claim.productRef, "TIKTOK_QC_CLAIM_PRODUCT_REQUIRED");
  if (!claim.evidenceIds.length) throw new Error("TIKTOK_QC_CLAIM_EVIDENCE_REQUIRED");
  if (claim.expiresAt) requireDate(claim.expiresAt, "TIKTOK_QC_CLAIM_EXPIRY_INVALID");
}

function requireOffer(offer: TikTokCommercialOfferEvidence): void {
  requireText(offer.offerRef, "TIKTOK_QC_OFFER_REF_REQUIRED");
  requireText(offer.productRef, "TIKTOK_QC_OFFER_PRODUCT_REQUIRED");
  if (!offer.evidenceIds.length) throw new Error("TIKTOK_QC_OFFER_EVIDENCE_REQUIRED");
  if (offer.validFrom) requireDate(offer.validFrom, "TIKTOK_QC_OFFER_VALID_FROM_INVALID");
  if (offer.validUntil) requireDate(offer.validUntil, "TIKTOK_QC_OFFER_VALID_UNTIL_INVALID");
  if (
    offer.validFrom &&
    offer.validUntil &&
    Date.parse(offer.validUntil) <= Date.parse(offer.validFrom)
  ) {
    throw new Error("TIKTOK_QC_OFFER_WINDOW_INVALID");
  }
}

function requireText(value: string, code: string): void {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
}

function requireDate(value: string, code: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(code);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
