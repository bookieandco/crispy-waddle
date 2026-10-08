import { assertMarketDataUseAllowed, canSupportPointInTimeResearch,
  type MarketDataSourceContract, type MarketDataUsePurpose } from './market-data-source-contracts.js';
import { assertPointInTimeObservation, type MarketObservationRecord } from './market-provenance-contracts.js';

export const MONEY_FINISH_SOURCE_ADMISSION = 'MONEY-FINISH-04' as const;

export type MoneySourceAdmission = Readonly<{
  sourceId: string;
  observationId: string;
  informationCutoff: string;
  purpose: MarketDataUsePurpose;
  admission: 'RESEARCH_ONLY';
  evidenceIds: readonly string[];
  canAuthorizeLive: false;
}>;

export type MoneySourceReview = Readonly<{
  reviewId: string;
  codeClearance: 'VERIFIED' | 'UNKNOWN' | 'BLOCKED';
  codeCommitSha?: string;
  reviewEvidenceIds: readonly string[];
  allowedCapabilities: readonly string[];
}>;

function finiteTime(s: string, code: string): number {
  const t=Date.parse(s);
  if (!s.trim() || !Number.isFinite(t)) throw new Error(code);
  return t;
}

export function admitMoneyResearchObservation(input: Readonly<{
  source: MarketDataSourceContract;
  review: MoneySourceReview;
  observation: MarketObservationRecord;
  cutoff: string;
  purpose: MarketDataUsePurpose;
  requiredCapability: string;
}>): MoneySourceAdmission {
  const {source,review,observation,cutoff,purpose,requiredCapability}=input;
  if (source.sourceKind==='REFERENCE_CODE') throw new Error('MONEY_FINISH_REFERENCE_CODE_IS_NOT_A_DATA_FEED');
  if (review.codeClearance!=='VERIFIED' || !review.reviewId.trim() ||
      !review.reviewEvidenceIds.length ||
      (source.codeLicenseExpression && !/^[0-9a-f]{40}$/.test(review.codeCommitSha??''))) {
    throw new Error('MONEY_FINISH_SOURCE_REVIEW_NOT_VERIFIED');
  }
  if (!requiredCapability.trim() || !source.capabilities.includes(requiredCapability as typeof source.capabilities[number]) ||
      !review.allowedCapabilities.includes(requiredCapability)) {
    throw new Error('MONEY_FINISH_SOURCE_CAPABILITY_NOT_ADMITTED');
  }
  assertMarketDataUseAllowed(source,purpose);
  if (!canSupportPointInTimeResearch(source) || !source.supportsAvailableAt) {
    throw new Error('MONEY_FINISH_NATIVE_SOURCE_AVAILABILITY_NOT_PROVEN');
  }
  if (observation.provider!==source.sourceId || !observation.observationId.trim() ||
      !observation.evidenceRef.trim() || !observation.provenanceHash.trim() ||
      !observation.instrumentId.trim()) throw new Error('MONEY_FINISH_SOURCE_OBSERVATION_MISMATCH');
  const observed=finiteTime(observation.observedAt,'MONEY_FINISH_OBSERVED_TIME_INVALID');
  const received=finiteTime(observation.receivedAt,'MONEY_FINISH_RECEIVED_TIME_INVALID');
  const available=finiteTime(observation.availableAt,'MONEY_FINISH_AVAILABLE_TIME_INVALID');
  const end=finiteTime(cutoff,'MONEY_FINISH_CUTOFF_INVALID');
  finiteTime(observation.effectiveAt,'MONEY_FINISH_EFFECTIVE_TIME_INVALID');
  if (observed>received || observed>available || received>end || available>end) {
    throw new Error('MONEY_FINISH_OBSERVATION_CHRONOLOGY_INVALID');
  }
  // Existing quality + future-leak contract remains authoritative; numeric parsing above prevents
  // lexicographic ordering from incorrectly accepting timezone-different timestamps.
  assertPointInTimeObservation(observation,cutoff);
  return Object.freeze({sourceId:source.sourceId,observationId:observation.observationId,
    informationCutoff:cutoff,purpose,admission:'RESEARCH_ONLY',canAuthorizeLive:false,
    evidenceIds:Object.freeze([source.provenanceHash,review.reviewId,...review.reviewEvidenceIds,observation.evidenceRef].sort())});
}
