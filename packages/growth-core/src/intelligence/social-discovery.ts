import type {
  BuyerIntentLevel,
  SocialObservation,
  SocialPerformanceSignal,
} from './social-intelligence.js';

const HIGH_INTENT = [
  'where can i buy',
  'how much',
  'price',
  'buy this',
  'purchase',
  'available',
  'availability',
  'shipping',
  'link',
  'order',
];

const MEDIUM_INTENT = [
  'which one',
  'recommend',
  'looking for',
  'need this',
  'save this',
  'want this',
  'where do i get',
  'does this ship',
];

export interface SocialSignalAnalysis {
  readonly level: BuyerIntentLevel;
  readonly matchedSignals: readonly string[];
  readonly confidence: number;
}

export function analyzeBuyerSignals(signals: readonly string[]): SocialSignalAnalysis {
  const normalized = signals.map((signal) => signal.toLowerCase().trim()).filter(Boolean);
  const joined = normalized.join(' ');
  const high = HIGH_INTENT.filter((signal) => joined.includes(signal));
  const medium = MEDIUM_INTENT.filter((signal) => joined.includes(signal));

  if (high.length > 0) {
    return { level: 'high', matchedSignals: high, confidence: Math.min(1, 0.75 + high.length * 0.05) };
  }
  if (medium.length > 0) {
    return { level: 'medium', matchedSignals: medium, confidence: Math.min(0.8, 0.5 + medium.length * 0.05) };
  }
  if (normalized.length > 0) {
    return { level: 'low', matchedSignals: normalized.slice(0, 3), confidence: 0.25 };
  }
  return { level: 'none', matchedSignals: [], confidence: 0 };
}

export function calculatePerformanceSignal(
  observation: SocialObservation,
  options: {
    creatorBaseline?: number;
    previousEngagement?: number;
    hoursObserved?: number;
    crossPlatformPresence?: number;
  } = {},
): SocialPerformanceSignal {
  const { views = 0, likes = 0, comments = 0, shares = 0, saves = 0 } = observation.engagement;
  const interactions = likes + comments + shares + saves;
  const engagementRate = views > 0 ? interactions / views : undefined;
  const engagementVelocity = options.hoursObserved && options.hoursObserved > 0
    ? interactions / options.hoursObserved
    : undefined;
  const creatorBaseline = options.creatorBaseline;
  const performanceLift = creatorBaseline && creatorBaseline > 0 && engagementRate !== undefined
    ? engagementRate / creatorBaseline
    : undefined;
  const ageHours = Math.max(0, (Date.now() - Date.parse(observation.observedAt)) / 3_600_000);
  const recencyScore = Math.max(0, Math.min(1, 1 / (1 + ageHours / 168)));
  const crossPlatformPresence = Math.max(0, Math.min(1, options.crossPlatformPresence ?? 0));
  const liftScore = performanceLift === undefined ? 0.5 : Math.max(0, Math.min(1, performanceLift / 5));
  const rateScore = engagementRate === undefined ? 0 : Math.max(0, Math.min(1, engagementRate * 10));
  const confidence = Math.max(0, Math.min(1, 0.4 * liftScore + 0.25 * rateScore + 0.2 * recencyScore + 0.15 * crossPlatformPresence));

  return {
    observationId: observation.id,
    engagementRate,
    engagementVelocity,
    creatorBaseline,
    performanceLift,
    recencyScore,
    crossPlatformPresence,
    confidence,
  };
}

export function isPerformanceOutlier(signal: SocialPerformanceSignal, minimumLift = 2): boolean {
  return signal.performanceLift !== undefined && signal.performanceLift >= minimumLift && signal.confidence >= 0.5;
}
