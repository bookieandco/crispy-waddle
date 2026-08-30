import type { GrowthId } from '../domain/types.js';
import type { SocialObservation, SocialPattern } from './social-intelligence.js';

const CTA_TERMS = ['buy', 'shop', 'learn more', 'comment', 'follow', 'subscribe', 'link', 'order'];
const HOOK_PATTERNS: readonly [string, RegExp][] = [
  ['question', /^(why|how|what|where|when|who)\b/i],
  ['numbered', /^(\d+|three|five|seven|10)\s+(things|ways|tips|mistakes|reasons)/i],
  ['problem', /^(stop|avoid|don\'t|never|mistake|problem)/i],
  ['curiosity', /\b(secret|nobody|you won\'t believe|surprising|truth)\b/i],
];

function detectHook(text?: string): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trim();
  const match = HOOK_PATTERNS.find(([, pattern]) => pattern.test(trimmed));
  return match?.[0];
}

function detectCta(text?: string): string | undefined {
  if (!text) return undefined;
  const normalized = text.toLowerCase();
  return CTA_TERMS.find((term) => normalized.includes(term));
}

function detectFormat(observation: SocialObservation): string {
  if (observation.mediaType === 'video' && observation.engagement.views) return 'short-video';
  return observation.mediaType;
}

export function extractSocialPattern(
  observation: SocialObservation,
  sourceObservationIds: readonly GrowthId[] = [observation.id],
): SocialPattern {
  const text = observation.text?.trim();
  const hook = detectHook(text);
  const cta = detectCta(text);
  const topic = observation.topic?.trim();
  const signals = [...observation.audienceSignals, ...observation.commercialSignals];

  return {
    id: `social-pattern:${observation.id}` as GrowthId,
    sourceObservationIds,
    platforms: [observation.platform],
    topic,
    hook,
    format: detectFormat(observation),
    structure: hook === 'numbered' ? 'numbered-list' : hook === 'question' ? 'question-answer' : undefined,
    visualPattern: observation.mediaType === 'video' ? 'video-led' : undefined,
    emotionalDriver: hook === 'problem' ? 'problem-avoidance' : hook === 'curiosity' ? 'curiosity' : undefined,
    cta,
    audienceSignals: signals,
    confidence: hook || cta || topic ? 0.6 : 0.25,
  };
}

export function mergeSocialPatterns(patterns: readonly SocialPattern[]): SocialPattern | undefined {
  if (patterns.length === 0) return undefined;
  const first = patterns[0];
  const sourceObservationIds = [...new Set(patterns.flatMap((pattern) => pattern.sourceObservationIds))];
  const platforms = [...new Set(patterns.flatMap((pattern) => pattern.platforms))];
  const audienceSignals = [...new Set(patterns.flatMap((pattern) => pattern.audienceSignals))];
  const confidence = Math.min(1, patterns.reduce((sum, pattern) => sum + pattern.confidence, 0) / patterns.length + Math.min(0.2, (patterns.length - 1) * 0.03));

  return {
    ...first,
    id: `social-pattern:cluster:${sourceObservationIds.sort().join('|')}` as GrowthId,
    sourceObservationIds,
    platforms,
    audienceSignals,
    confidence,
  };
}
