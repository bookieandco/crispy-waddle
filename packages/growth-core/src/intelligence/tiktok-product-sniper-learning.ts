import type { OpportunityOutcome } from "@jhadina/opportunity-core";

export type TikTokProductSniperLane = "affiliate" | "pod_seller";

export type TikTokProductSniperOutcomeSample = {
  id: string;
  productRef: string;
  lane: TikTokProductSniperLane;
  category?: string;
  price: number;
  currency: string;
  creatorCount?: number;
  weeklyGrowthRate?: number;
  searchDemandPerCompetitor?: number;
  creativeFormat?: string;
  outcome: Pick<
    OpportunityOutcome,
    "result" | "profit" | "margin" | "dollarsPerHour" | "observedAt" | "evidenceRefs"
  >;
  evidenceRefs: readonly string[];
};

export type TikTokProductSniperSegment = {
  key: string;
  sampleCount: number;
  wins: number;
  losses: number;
  winRate: number;
  averageProfit: number;
  averageMargin?: number;
  averageDollarsPerHour?: number;
  confidence: number;
};

export type TikTokProductSniperLearningProfile = {
  sampleCount: number;
  segments: readonly TikTokProductSniperSegment[];
  evidenceRefs: readonly string[];
  learnedAt: string;
  authority: "REALIZED_OUTCOME_LEARNING_ONLY";
  projectedGmvUsedAsOutcome: false;
};

export type TikTokProductSniperCandidateFeatures = {
  lane: TikTokProductSniperLane;
  category?: string;
  price: number;
  creatorCount?: number;
  creativeFormat?: string;
};

export type TikTokProductSniperRealizedAdjustment = {
  adjustment: number;
  matchedSegments: readonly TikTokProductSniperSegment[];
  reasons: readonly string[];
  confidence: number;
  evidenceRefs: readonly string[];
  authority: "RANKING_ADJUSTMENT_ONLY";
  externalActionAuthorized: false;
};

export function learnTikTokProductSniperFromRealizedOutcomes(input: {
  samples: readonly TikTokProductSniperOutcomeSample[];
  learnedAt: string;
}): TikTokProductSniperLearningProfile {
  requireDate(input.learnedAt, "TIKTOK_SNIPER_LEARNED_AT_INVALID");
  const samples = input.samples.map(assertSample);
  const buckets = new Map<string, TikTokProductSniperOutcomeSample[]>();

  for (const sample of samples) {
    for (const key of segmentKeys(sample)) {
      const current = buckets.get(key) ?? [];
      current.push(sample);
      buckets.set(key, current);
    }
  }

  const segments = [...buckets.entries()]
    .map(([key, group]) => summarizeSegment(key, group))
    .sort((a, b) => b.confidence - a.confidence || b.sampleCount - a.sampleCount || a.key.localeCompare(b.key));

  return Object.freeze({
    sampleCount: samples.length,
    segments: Object.freeze(segments),
    evidenceRefs: Object.freeze(unique(
      samples.flatMap((sample) => [
        ...sample.evidenceRefs,
        ...sample.outcome.evidenceRefs,
      ]),
    )),
    learnedAt: input.learnedAt,
    authority: "REALIZED_OUTCOME_LEARNING_ONLY" as const,
    projectedGmvUsedAsOutcome: false as const,
  });
}

export function scoreTikTokProductSniperWithRealizedLearning(input: {
  profile: TikTokProductSniperLearningProfile;
  candidate: TikTokProductSniperCandidateFeatures;
  maxAbsoluteAdjustment?: number;
}): TikTokProductSniperRealizedAdjustment {
  const max = input.maxAbsoluteAdjustment ?? 15;
  if (!Number.isFinite(max) || max <= 0 || max > 25) {
    throw new Error("TIKTOK_SNIPER_ADJUSTMENT_BOUND_INVALID");
  }
  if (!Number.isFinite(input.candidate.price) || input.candidate.price < 0) {
    throw new Error("TIKTOK_SNIPER_CANDIDATE_PRICE_INVALID");
  }

  const keys = new Set(candidateSegmentKeys(input.candidate));
  const matched = input.profile.segments.filter((segment) => keys.has(segment.key));
  if (!matched.length) {
    return Object.freeze({
      adjustment: 0,
      matchedSegments: Object.freeze([]),
      reasons: Object.freeze(["No realized-outcome segment matches this candidate yet."]),
      confidence: 0,
      evidenceRefs: input.profile.evidenceRefs,
      authority: "RANKING_ADJUSTMENT_ONLY" as const,
      externalActionAuthorized: false as const,
    });
  }

  let weightedSignal = 0;
  let weight = 0;
  for (const segment of matched) {
    const profitSignal = Math.tanh(segment.averageProfit / 50);
    const winSignal = (segment.winRate - 0.5) * 2;
    const marginSignal =
      segment.averageMargin === undefined
        ? 0
        : Math.max(-1, Math.min(1, segment.averageMargin));
    const signal = profitSignal * 0.5 + winSignal * 0.3 + marginSignal * 0.2;
    weightedSignal += signal * segment.confidence;
    weight += segment.confidence;
  }

  const normalized = weight > 0 ? weightedSignal / weight : 0;
  const adjustment = round(Math.max(-max, Math.min(max, normalized * max)));
  const confidence = round(
    Math.min(1, matched.reduce((sum, segment) => sum + segment.confidence, 0) / matched.length),
  );
  const reasons = matched.slice(0, 5).map((segment) =>
    `${segment.key}: n=${segment.sampleCount}, winRate=${round(segment.winRate)}, avgProfit=${round(segment.averageProfit)}, confidence=${segment.confidence}`,
  );

  return Object.freeze({
    adjustment,
    matchedSegments: Object.freeze(matched),
    reasons: Object.freeze(reasons),
    confidence,
    evidenceRefs: input.profile.evidenceRefs,
    authority: "RANKING_ADJUSTMENT_ONLY" as const,
    externalActionAuthorized: false as const,
  });
}

function summarizeSegment(
  key: string,
  samples: TikTokProductSniperOutcomeSample[],
): TikTokProductSniperSegment {
  const wins = samples.filter((sample) => sample.outcome.result === "won").length;
  const margins = samples
    .map((sample) => sample.outcome.margin)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const hourly = samples
    .map((sample) => sample.outcome.dollarsPerHour)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  return Object.freeze({
    key,
    sampleCount: samples.length,
    wins,
    losses: samples.length - wins,
    winRate: samples.length ? wins / samples.length : 0,
    averageProfit: average(samples.map((sample) => sample.outcome.profit)) ?? 0,
    averageMargin: average(margins),
    averageDollarsPerHour: average(hourly),
    confidence: round(Math.min(1, samples.length / 10)),
  });
}

function segmentKeys(sample: TikTokProductSniperOutcomeSample): string[] {
  return candidateSegmentKeys(sample);
}

function candidateSegmentKeys(
  sample: TikTokProductSniperCandidateFeatures,
): string[] {
  return unique([
    `lane:${sample.lane}`,
    `price:${priceBand(sample.price)}`,
    sample.category ? `category:${normalize(sample.category)}` : "",
    sample.creatorCount !== undefined
      ? `creator-saturation:${creatorBand(sample.creatorCount)}`
      : "",
    sample.creativeFormat
      ? `creative:${normalize(sample.creativeFormat)}`
      : "",
  ]);
}

function priceBand(price: number): string {
  if (price < 25) return "under-25";
  if (price < 75) return "25-74";
  if (price < 200) return "75-199";
  return "200-plus";
}

function creatorBand(count: number): string {
  if (count <= 25) return "low";
  if (count <= 100) return "medium";
  return "high";
}

function assertSample(
  sample: TikTokProductSniperOutcomeSample,
): TikTokProductSniperOutcomeSample {
  if (!sample.id.trim() || !sample.productRef.trim()) {
    throw new Error("TIKTOK_SNIPER_SAMPLE_IDENTITY_REQUIRED");
  }
  if (!Number.isFinite(sample.price) || sample.price < 0) {
    throw new Error("TIKTOK_SNIPER_SAMPLE_PRICE_INVALID");
  }
  if (!/^[A-Za-z]{3}$/.test(sample.currency.trim())) {
    throw new Error("TIKTOK_SNIPER_SAMPLE_CURRENCY_INVALID");
  }
  if (
    sample.creatorCount !== undefined &&
    (!Number.isFinite(sample.creatorCount) || sample.creatorCount < 0)
  ) {
    throw new Error("TIKTOK_SNIPER_SAMPLE_CREATORS_INVALID");
  }
  requireDate(sample.outcome.observedAt, "TIKTOK_SNIPER_OUTCOME_DATE_INVALID");
  if (!Number.isFinite(sample.outcome.profit)) {
    throw new Error("TIKTOK_SNIPER_OUTCOME_PROFIT_INVALID");
  }
  if (!sample.evidenceRefs.length || !sample.outcome.evidenceRefs.length) {
    throw new Error("TIKTOK_SNIPER_REALIZED_EVIDENCE_REQUIRED");
  }
  return {
    ...sample,
    currency: sample.currency.trim().toUpperCase(),
    evidenceRefs: unique(sample.evidenceRefs),
  };
}

function average(values: number[]): number | undefined {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : undefined;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function requireDate(value: string, code: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(code);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
