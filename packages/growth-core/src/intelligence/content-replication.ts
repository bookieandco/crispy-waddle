import type { GrowthId } from '../domain/types.js';

export interface HighPerformingPost {
  readonly id: GrowthId;
  readonly platform: string;
  readonly topic: string;
  readonly text: string;
  readonly metrics: Readonly<Record<string, number>>;
  readonly observedAt: string;
}

export interface ContentPattern {
  readonly id: GrowthId;
  readonly sourcePostId: GrowthId;
  readonly hook: string;
  readonly format: string;
  readonly emotionalMechanism: string;
  readonly audienceTrigger: string;
  readonly evidence: readonly string[];
}

export interface OriginalVariantBrief {
  readonly patternId: GrowthId;
  readonly targetAudience: string;
  readonly platform: string;
  readonly constraints: readonly string[];
}

export function extractContentPattern(post: HighPerformingPost): ContentPattern {
  const lower = post.text.toLowerCase();
  const hook = post.text.split(/[.!?\n]/)[0]?.trim() || post.text.slice(0, 120);
  const format = post.text.includes('\n') ? 'structured_text' : post.text.length < 120 ? 'short_form' : 'long_form';
  const emotionalMechanism = /(funny|lol|😂|haha)/i.test(post.text) ? 'humor' : /(surpris|unexpected|didnt expect)/i.test(lower) ? 'surprise' : /(tip|how to|guide)/i.test(lower) ? 'utility' : 'curiosity';
  const audienceTrigger = /(buy|price|cost|recommend|where|need|looking for)/i.test(lower) ? 'purchase_intent' : 'engagement';
  return { id: `pattern:${post.id}` as GrowthId, sourcePostId: post.id, hook, format, emotionalMechanism, audienceTrigger, evidence: Object.entries(post.metrics).map(([key, value]) => `${key}=${value}`) };
}

export function createOriginalVariantBrief(pattern: ContentPattern, input: { targetAudience: string; platform: string }): OriginalVariantBrief {
  return { patternId: pattern.id, targetAudience: input.targetAudience, platform: input.platform, constraints: ['preserve_pattern_not_wording', 'create_original_content', 'do_not_impersonate_source', 'do_not_reproduce_protected_expression'] };
}
