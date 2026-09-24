import type { GrowthId } from '../domain/types.js';

export type SocialSignalClass = 'attention' | 'intent' | 'conversion';

export interface SocialSignalObservation {
  readonly id: GrowthId;
  readonly topic: string;
  readonly platform: string;
  readonly observedAt: string;
  readonly signal: string;
  readonly value: number;
  readonly confidence: number;
  readonly evidence: readonly GrowthId[];
  readonly conversion?: { revenue: number; spend: number; conversions: number };
}

export interface ClassifiedSocialSignal extends SocialSignalObservation {
  readonly signalClass: SocialSignalClass;
  readonly commercialWeight: number;
}

export function classifySocialSignal(observation: SocialSignalObservation): ClassifiedSocialSignal {
  const text = observation.signal.trim().toLowerCase();
  const hasConversion = Boolean(observation.conversion && observation.conversion.conversions > 0);
  const intentTerms = ['buy', 'price', 'cost', 'where', 'order', 'available', 'link', 'recommend'];
  const isIntent = intentTerms.some((term) => text.includes(term));
  const signalClass: SocialSignalClass = hasConversion ? 'conversion' : isIntent ? 'intent' : 'attention';
  const commercialWeight = signalClass === 'conversion' ? 1 : signalClass === 'intent' ? 0.65 : 0.15;

  return { ...observation, signalClass, commercialWeight };
}

export function commercialSignalValue(signal: ClassifiedSocialSignal): number {
  const base = Math.max(0, signal.value) * signal.commercialWeight * Math.max(0, Math.min(1, signal.confidence));
  if (signal.signalClass !== 'conversion' || !signal.conversion) return base;
  const revenue = Math.max(0, signal.conversion.revenue);
  const spend = Math.max(0, signal.conversion.spend);
  return spend > 0 ? Math.max(-1, Math.min(10, (revenue - spend) / spend)) : Math.min(10, revenue / 100);
}
