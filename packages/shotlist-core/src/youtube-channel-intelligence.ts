export type YouTubeChannelArchetype =
  | 'storytelling'
  | 'documentary'
  | 'ranking'
  | 'screen-recording'
  | 'product-review'
  | 'ai-music'
  | 'compilation'
  | 'other';

export type YouTubeMonetizationRail =
  | 'ads'
  | 'affiliate'
  | 'sponsor'
  | 'product'
  | 'service'
  | 'membership'
  | 'licensing';

export type YouTubeOriginalityPlan = 'original' | 'transformative' | 'reused-heavy';

export interface YouTubeComparableSignal {
  id: string;
  sourceRef: string;
  channelAgeDays?: number;
  channelSubscribers?: number;
  videoViews?: number;
  videoAgeDays?: number;
  viewsPerHour?: number;
  outlierScore?: number;
  monetizationObserved?: boolean;
}

export interface YouTubeNicheCandidate {
  id: string;
  channelId: string;
  niche: string;
  archetype: YouTubeChannelArchetype;
  canSustain100Videos: boolean;
  monetizationRails: readonly YouTubeMonetizationRail[];
  originalityPlan: YouTubeOriginalityPlan;
  automationFit: number;
  comparables: readonly YouTubeComparableSignal[];
  evidenceRefs: readonly string[];
}

export interface YouTubeNicheAssessment {
  admissible: boolean;
  score: number;
  factors: Readonly<{
    repeatability: number;
    observedDemand: number;
    newChannelProof: number;
    monetizationClarity: number;
    originalitySafety: number;
    automationFit: number;
  }>;
  reasons: readonly string[];
  authority: 'YOUTUBE_CHANNEL_INTELLIGENCE';
}

export interface YouTubeTopicSignalPolicy {
  minimumOutlierScore: number;
  strongOutlierScore: number;
  recentWindowDays: number;
  minimumRecentViewsPerHour: number;
  evergreenWindowDays: number;
  minimumEvergreenViewsPerHour: number;
  authority: 'SOURCE_HEURISTIC';
}

/**
 * Heuristics transcribed from the supplied creator workflow. These are not
 * treated as YouTube platform rules and should be replaced by channel-owned
 * empirical baselines once enough first-party observations exist.
 */
export const DEFAULT_SOURCE_HEURISTIC_TOPIC_POLICY: YouTubeTopicSignalPolicy = Object.freeze({
  minimumOutlierScore: 20,
  strongOutlierScore: 50,
  recentWindowDays: 90,
  minimumRecentViewsPerHour: 100,
  evergreenWindowDays: 365,
  minimumEvergreenViewsPerHour: 20,
  authority: 'SOURCE_HEURISTIC',
});

export interface YouTubeTopicCandidate {
  id: string;
  channelId: string;
  title: string;
  premise: string;
  monetizationFitScore: number;
  originalityRisk: number;
  evidence: readonly YouTubeComparableSignal[];
  evidenceRefs: readonly string[];
}

export interface YouTubeTopicAssessment {
  topicId: string;
  score: number;
  demandState: 'insufficient' | 'watch' | 'validated' | 'strong';
  sourceHeuristicMatches: readonly string[];
  reasons: readonly string[];
  authority: 'YOUTUBE_TOPIC_INTELLIGENCE';
}

export interface YouTubeVideoPerformanceObservation {
  id: string;
  channelId: string;
  videoId: string;
  observedAt: string;
  impressions: number;
  views: number;
  clickThroughRate: number;
  averageViewDurationSeconds: number;
  videoDurationSeconds: number;
  subscribersGained: number;
  revenueUsd?: number;
  evidenceRefs: readonly string[];
}

export interface YouTubeChannelPerformanceBaseline {
  minimumObservations: number;
  medianClickThroughRate: number;
  medianAveragePercentViewed: number;
  medianSubscribersPerThousandViews: number;
}

export interface YouTubeVideoDiagnosis {
  packaging: 'below-baseline' | 'at-or-above-baseline';
  retention: 'below-baseline' | 'at-or-above-baseline';
  subscriberConversion: 'below-baseline' | 'at-or-above-baseline';
  averagePercentViewed: number;
  subscribersPerThousandViews: number;
  reasons: readonly string[];
  authority: 'YOUTUBE_PERFORMANCE_DIAGNOSIS';
}

export interface YouTubeProductionRecipe {
  archetype: YouTubeChannelArchetype;
  scriptStrategy: readonly string[];
  visualStrategy: readonly string[];
  audioStrategy: readonly string[];
  assemblyStrategy: readonly string[];
  reusedContentRisk: 'low' | 'medium' | 'high';
  requiresRightsReview: boolean;
  authority: 'YOUTUBE_PRODUCTION_RECIPE';
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) throw new Error('YOUTUBE_SCORE_MUST_BE_FINITE');
  return Math.max(0, Math.min(1, value));
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

export function assessYouTubeNiche(candidate: YouTubeNicheCandidate): YouTubeNicheAssessment {
  const reasons: string[] = [];
  if (!candidate.id.trim() || !candidate.channelId.trim() || !candidate.niche.trim()) {
    reasons.push('YOUTUBE_NICHE_IDENTITY_REQUIRED');
  }
  if (!candidate.evidenceRefs.length) reasons.push('YOUTUBE_NICHE_EVIDENCE_REQUIRED');
  if (!candidate.monetizationRails.length) reasons.push('YOUTUBE_NICHE_MONETIZATION_PATH_REQUIRED');
  if (candidate.automationFit < 0 || candidate.automationFit > 1 || !Number.isFinite(candidate.automationFit)) {
    reasons.push('YOUTUBE_NICHE_AUTOMATION_FIT_INVALID');
  }
  for (const comparable of candidate.comparables) {
    if (!comparable.id.trim() || !comparable.sourceRef.trim()) reasons.push('YOUTUBE_NICHE_COMPARABLE_EVIDENCE_REQUIRED');
  }

  const repeatability = candidate.canSustain100Videos ? 1 : 0;
  const observedDemand = clamp01(candidate.comparables.filter(item =>
    (item.videoViews ?? 0) > 0 || (item.viewsPerHour ?? 0) > 0 || (item.outlierScore ?? 0) > 0,
  ).length / 3);
  const newChannelProof = clamp01(candidate.comparables.filter(item =>
    item.channelAgeDays !== undefined &&
    item.channelAgeDays <= 180 &&
    (item.videoViews ?? 0) >= Math.max(1, item.channelSubscribers ?? 0),
  ).length / 2);
  const monetizationClarity = clamp01(candidate.monetizationRails.length / 2);
  const originalitySafety = candidate.originalityPlan === 'original'
    ? 1
    : candidate.originalityPlan === 'transformative'
      ? 0.7
      : 0.2;
  const automationFit = clamp01(candidate.automationFit);

  const score = Math.round(100 * (
    repeatability * 0.2 +
    observedDemand * 0.25 +
    newChannelProof * 0.15 +
    monetizationClarity * 0.15 +
    originalitySafety * 0.15 +
    automationFit * 0.1
  ));

  if (!candidate.canSustain100Videos) reasons.push('YOUTUBE_NICHE_REPEATABILITY_WEAK');
  if (observedDemand < 0.34) reasons.push('YOUTUBE_NICHE_DEMAND_EVIDENCE_THIN');
  if (candidate.originalityPlan === 'reused-heavy') reasons.push('YOUTUBE_NICHE_REUSED_CONTENT_RISK_HIGH');

  return Object.freeze({
    admissible: reasons.every(reason =>
      !['YOUTUBE_NICHE_IDENTITY_REQUIRED','YOUTUBE_NICHE_EVIDENCE_REQUIRED','YOUTUBE_NICHE_MONETIZATION_PATH_REQUIRED','YOUTUBE_NICHE_AUTOMATION_FIT_INVALID','YOUTUBE_NICHE_COMPARABLE_EVIDENCE_REQUIRED']
        .includes(reason),
    ),
    score,
    factors: Object.freeze({ repeatability, observedDemand, newChannelProof, monetizationClarity, originalitySafety, automationFit }),
    reasons: Object.freeze(unique(reasons)),
    authority: 'YOUTUBE_CHANNEL_INTELLIGENCE',
  });
}

export function assessYouTubeTopic(
  topic: YouTubeTopicCandidate,
  policy: YouTubeTopicSignalPolicy = DEFAULT_SOURCE_HEURISTIC_TOPIC_POLICY,
): YouTubeTopicAssessment {
  const reasons: string[] = [];
  if (!topic.id.trim() || !topic.channelId.trim() || !topic.title.trim() || !topic.premise.trim()) {
    reasons.push('YOUTUBE_TOPIC_IDENTITY_REQUIRED');
  }
  if (!topic.evidence.length || !topic.evidenceRefs.length) reasons.push('YOUTUBE_TOPIC_EVIDENCE_REQUIRED');
  const monetizationFitScore = clamp01(topic.monetizationFitScore);
  const originalityRisk = clamp01(topic.originalityRisk);

  let matches = 0;
  const sourceHeuristicMatches: string[] = [];
  for (const item of topic.evidence) {
    if ((item.outlierScore ?? 0) >= policy.minimumOutlierScore) {
      matches += 1;
      sourceHeuristicMatches.push(`outlier>=${policy.minimumOutlierScore}:${item.id}`);
    }
    if ((item.outlierScore ?? 0) >= policy.strongOutlierScore) {
      matches += 1;
      sourceHeuristicMatches.push(`outlier>=${policy.strongOutlierScore}:${item.id}`);
    }
    const age = item.videoAgeDays;
    const vph = item.viewsPerHour;
    if (age !== undefined && vph !== undefined) {
      if (age <= policy.recentWindowDays && vph >= policy.minimumRecentViewsPerHour) {
        matches += 1;
        sourceHeuristicMatches.push(`recent-vph>=${policy.minimumRecentViewsPerHour}:${item.id}`);
      }
      if (age >= policy.evergreenWindowDays && vph >= policy.minimumEvergreenViewsPerHour) {
        matches += 1;
        sourceHeuristicMatches.push(`evergreen-vph>=${policy.minimumEvergreenViewsPerHour}:${item.id}`);
      }
    }
  }

  const evidenceStrength = clamp01(matches / Math.max(2, topic.evidence.length * 2));
  const score = Math.round(100 * (
    evidenceStrength * 0.6 +
    monetizationFitScore * 0.25 +
    (1 - originalityRisk) * 0.15
  ));
  const demandState: YouTubeTopicAssessment['demandState'] =
    score >= 80 ? 'strong' :
    score >= 60 ? 'validated' :
    score >= 40 ? 'watch' :
    'insufficient';

  if (originalityRisk >= 0.7) reasons.push('YOUTUBE_TOPIC_ORIGINALITY_RISK_HIGH');
  if (!sourceHeuristicMatches.length) reasons.push('YOUTUBE_TOPIC_SOURCE_HEURISTIC_NOT_MET');
  reasons.push('YOUTUBE_TOPIC_HEURISTICS_ARE_NOT_PLATFORM_GUARANTEES');

  return Object.freeze({
    topicId: topic.id,
    score,
    demandState,
    sourceHeuristicMatches: Object.freeze(unique(sourceHeuristicMatches)),
    reasons: Object.freeze(unique(reasons)),
    authority: 'YOUTUBE_TOPIC_INTELLIGENCE',
  });
}

export function diagnoseYouTubeVideo(
  observation: YouTubeVideoPerformanceObservation,
  baseline: YouTubeChannelPerformanceBaseline,
): YouTubeVideoDiagnosis {
  if (!observation.id.trim() || !observation.channelId.trim() || !observation.videoId.trim()) {
    throw new Error('YOUTUBE_PERFORMANCE_IDENTITY_REQUIRED');
  }
  if (!Number.isFinite(Date.parse(observation.observedAt))) throw new Error('YOUTUBE_PERFORMANCE_TIME_INVALID');
  if (!observation.evidenceRefs.length) throw new Error('YOUTUBE_PERFORMANCE_EVIDENCE_REQUIRED');
  if (observation.impressions < 0 || observation.views < 0 || observation.subscribersGained < 0) {
    throw new Error('YOUTUBE_PERFORMANCE_COUNT_INVALID');
  }
  const ctr = clamp01(observation.clickThroughRate);
  if (!Number.isFinite(observation.videoDurationSeconds) || observation.videoDurationSeconds <= 0) {
    throw new Error('YOUTUBE_PERFORMANCE_DURATION_INVALID');
  }
  if (!Number.isFinite(observation.averageViewDurationSeconds) || observation.averageViewDurationSeconds < 0) {
    throw new Error('YOUTUBE_PERFORMANCE_AVD_INVALID');
  }
  const averagePercentViewed = clamp01(observation.averageViewDurationSeconds / observation.videoDurationSeconds);
  const subscribersPerThousandViews = observation.views > 0
    ? observation.subscribersGained / observation.views * 1000
    : 0;

  const packaging = ctr < baseline.medianClickThroughRate ? 'below-baseline' : 'at-or-above-baseline';
  const retention = averagePercentViewed < baseline.medianAveragePercentViewed ? 'below-baseline' : 'at-or-above-baseline';
  const subscriberConversion = subscribersPerThousandViews < baseline.medianSubscribersPerThousandViews
    ? 'below-baseline'
    : 'at-or-above-baseline';

  const reasons = [
    `ctr=${ctr.toFixed(4)} baseline=${baseline.medianClickThroughRate.toFixed(4)}`,
    `average_percent_viewed=${averagePercentViewed.toFixed(4)} baseline=${baseline.medianAveragePercentViewed.toFixed(4)}`,
    `subs_per_1000=${subscribersPerThousandViews.toFixed(2)} baseline=${baseline.medianSubscribersPerThousandViews.toFixed(2)}`,
  ];
  return Object.freeze({
    packaging,
    retention,
    subscriberConversion,
    averagePercentViewed,
    subscribersPerThousandViews,
    reasons: Object.freeze(reasons),
    authority: 'YOUTUBE_PERFORMANCE_DIAGNOSIS',
  });
}

export function getYouTubeProductionRecipe(archetype: YouTubeChannelArchetype): YouTubeProductionRecipe {
  const shared = {
    audioStrategy: Object.freeze(['use owned/licensed narration or music', 'preserve source/provenance for every audio asset']),
    authority: 'YOUTUBE_PRODUCTION_RECIPE' as const,
  };

  if (archetype === 'ai-music') {
    return Object.freeze({
      archetype,
      scriptStrategy: Object.freeze(['define music sub-niche, use case, mood, and session duration']),
      visualStrategy: Object.freeze(['select a static background or build seamless first-frame=last-frame loops', 'optionally rotate multiple loops for variation']),
      audioStrategy: Object.freeze(['generate or license a themed track set with commercial rights', 'sequence tracks with overlaps and crossfades', 'retain track-level provenance']),
      assemblyStrategy: Object.freeze(['assemble long-form session', 'repeat only approved tracks/loops intentionally', 'quality-check loop seams and crossfades before export']),
      reusedContentRisk: 'low',
      requiresRightsReview: true,
      authority: 'YOUTUBE_PRODUCTION_RECIPE',
    });
  }

  if (archetype === 'storytelling' || archetype === 'documentary') {
    return Object.freeze({
      archetype,
      scriptStrategy: Object.freeze(['research the topic', 'outline the full narrative', 'draft section-by-section instead of one-shot scripting', 'review hook, pacing, and factual support']),
      visualStrategy: Object.freeze(['map narration beats to owned/licensed/AI-generated visuals', 'track visual provenance per beat', 'prefer original generated assets where practical']),
      audioStrategy: shared.audioStrategy,
      assemblyStrategy: Object.freeze(['place narration first', 'assemble visuals against narration beats', 'review retention-sensitive pacing', 'finish title/thumbnail packaging separately']),
      reusedContentRisk: 'low',
      requiresRightsReview: true,
      authority: 'YOUTUBE_PRODUCTION_RECIPE',
    });
  }

  if (archetype === 'screen-recording') {
    return Object.freeze({
      archetype,
      scriptStrategy: Object.freeze(['define the user problem and tutorial outcome', 'write steps around an original demonstration']),
      visualStrategy: Object.freeze(['record original screen/device/process footage', 'add callouts only when they improve clarity']),
      audioStrategy: shared.audioStrategy,
      assemblyStrategy: Object.freeze(['sync narration to demonstrations', 'remove dead time', 'package around the concrete outcome']),
      reusedContentRisk: 'low',
      requiresRightsReview: false,
      authority: 'YOUTUBE_PRODUCTION_RECIPE',
    });
  }

  if (archetype === 'ranking' || archetype === 'product-review') {
    return Object.freeze({
      archetype,
      scriptStrategy: Object.freeze(['define ranking/review criteria', 'research each item', 'write original comparisons and commentary']),
      visualStrategy: Object.freeze(['use rights-cleared product/media assets', 'build original ranking/tier/list visuals']),
      audioStrategy: shared.audioStrategy,
      assemblyStrategy: Object.freeze(['sync ranking changes to narration', 'use simple readable packaging', 'preserve evidence for claims and affiliate disclosures']),
      reusedContentRisk: 'medium',
      requiresRightsReview: true,
      authority: 'YOUTUBE_PRODUCTION_RECIPE',
    });
  }

  if (archetype === 'compilation') {
    return Object.freeze({
      archetype,
      scriptStrategy: Object.freeze(['add original thesis, commentary, context, or analysis instead of relying on clips alone']),
      visualStrategy: Object.freeze(['treat every third-party clip as rights-sensitive', 'avoid a clip-only assembly path']),
      audioStrategy: shared.audioStrategy,
      assemblyStrategy: Object.freeze(['make transformation/editorial contribution explicit', 'run rights and originality review before publish']),
      reusedContentRisk: 'high',
      requiresRightsReview: true,
      authority: 'YOUTUBE_PRODUCTION_RECIPE',
    });
  }

  return Object.freeze({
    archetype,
    scriptStrategy: Object.freeze(['define audience promise', 'outline', 'draft', 'review for originality and value']),
    visualStrategy: Object.freeze(['use owned/licensed/AI-generated assets with provenance']),
    audioStrategy: shared.audioStrategy,
    assemblyStrategy: Object.freeze(['assemble', 'review', 'package', 'publish only after rights/originality checks']),
    reusedContentRisk: 'medium',
    requiresRightsReview: true,
    authority: 'YOUTUBE_PRODUCTION_RECIPE',
  });
}
