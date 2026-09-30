import type { ContentExperiment, PerformanceObservation, SongRecord } from './domain.js';

export type CoreMusicContentFamily =
  | 'mini_music_video'
  | 'location_performance'
  | 'performance_platform'
  | 'raw_performance'
  | 'story'
  | 'meme'
  | 'behind_the_scenes'
  | 'live'
  | 'community'
  | 'cinematic';

export interface CreativeVariantDescriptor {
  id: string;
  conceptId: string;
  family: CoreMusicContentFamily;
  songId: string;
  sectionId?: string;
  productionBurden: number;
  evidenceRefs: readonly string[];
}

export interface CreativeDiversityAssessment {
  distinctConcepts: number;
  distinctFamilies: number;
  variantCount: number;
  diversityScore: number;
  adequateForExploration: boolean;
  missingCoreFamilies: readonly CoreMusicContentFamily[];
  reasons: readonly string[];
}

export interface SectionHeat {
  sectionId: string;
  observations: number;
  weightedScore: number;
  songActionRate: number;
  directFanRate: number;
  confidence: number;
  evidenceRefs: readonly string[];
}

export function assessCreativeDiversity(
  variants: readonly CreativeVariantDescriptor[],
  minimumConcepts = 3,
): CreativeDiversityAssessment {
  if (!Number.isInteger(minimumConcepts) || minimumConcepts < 1) throw new Error('MUSIC_JUGGERNAUT_MIN_CONCEPTS_INVALID');
  if (!variants.length) {
    return Object.freeze({
      distinctConcepts: 0,
      distinctFamilies: 0,
      variantCount: 0,
      diversityScore: 0,
      adequateForExploration: false,
      missingCoreFamilies: Object.freeze(['mini_music_video','location_performance','performance_platform'] as const),
      reasons: Object.freeze(['No creative variants were supplied.']),
    });
  }
  for (const variant of variants) {
    if (!variant.id.trim() || !variant.conceptId.trim() || !variant.songId.trim()) throw new Error('MUSIC_JUGGERNAUT_CREATIVE_ID_REQUIRED');
    if (!Number.isFinite(variant.productionBurden) || variant.productionBurden < 0 || variant.productionBurden > 1) {
      throw new Error('MUSIC_JUGGERNAUT_PRODUCTION_BURDEN_INVALID');
    }
  }
  const concepts = new Set(variants.map((variant) => variant.conceptId));
  const families = new Set(variants.map((variant) => variant.family));
  const core: readonly CoreMusicContentFamily[] = ['mini_music_video','location_performance','performance_platform'];
  const missingCoreFamilies = core.filter((family) => !families.has(family));
  const diversityScore = round(Math.min(1, (concepts.size / Math.max(minimumConcepts, 1)) * 0.7 + (families.size / 5) * 0.3));
  const adequateForExploration = concepts.size >= minimumConcepts && families.size >= 2;
  return Object.freeze({
    distinctConcepts: concepts.size,
    distinctFamilies: families.size,
    variantCount: variants.length,
    diversityScore,
    adequateForExploration,
    missingCoreFamilies: Object.freeze(missingCoreFamilies),
    reasons: Object.freeze([
      concepts.size === variants.length
        ? 'Every supplied file represents a distinct concept.'
        : 'Some files are variations of the same concept; file count is not treated as idea count.',
      adequateForExploration
        ? 'Portfolio has enough concept diversity for exploratory testing.'
        : 'Exploration needs more genuinely different concepts or content families.',
    ]),
  });
}

export function buildSongSectionHeatmap(input: {
  song: SongRecord;
  experiments: readonly ContentExperiment[];
  observations: readonly PerformanceObservation[];
}): readonly SectionHeat[] {
  const experiments = new Map(input.experiments.filter((experiment) => experiment.songId === input.song.id).map((experiment) => [experiment.id, experiment]));
  return Object.freeze(input.song.sections.map((section) => {
    const sectionExperimentIds = new Set(
      [...experiments.values()].filter((experiment) => experiment.sectionId === section.id).map((experiment) => experiment.id),
    );
    const observations = input.observations.filter((observation) => sectionExperimentIds.has(observation.experimentId));
    const exposures = observations.reduce((sum, observation) => sum + observation.exposures, 0);
    const songActions = observations.reduce((sum, observation) => sum + observation.songActions, 0);
    const directFans = observations.reduce((sum, observation) => sum + observation.directFanCaptures, 0);
    const weightedScore = observations.reduce((sum, observation) => {
      const quality = (1 - observation.botRisk) * observation.attributionConfidence;
      return sum + quality * (
        observation.saves * 2 +
        observation.shares * 1.5 +
        observation.songActions * 4 +
        observation.directFanCaptures * 8
      );
    }, 0);
    return Object.freeze({
      sectionId: section.id,
      observations: observations.length,
      weightedScore: round(weightedScore),
      songActionRate: round(exposures === 0 ? 0 : songActions / exposures),
      directFanRate: round(exposures === 0 ? 0 : directFans / exposures),
      confidence: round(Math.min(1, observations.length / 5) * Math.min(1, exposures / 3000)),
      evidenceRefs: Object.freeze(unique(observations.flatMap((observation) => observation.evidenceRefs))),
    });
  }).sort((a, b) => b.weightedScore - a.weightedScore));
}

export function buildDefaultContentSpine(songId: string): readonly CreativeVariantDescriptor[] {
  if (!songId.trim()) throw new Error('MUSIC_JUGGERNAUT_SONG_ID_REQUIRED');
  return Object.freeze([
    Object.freeze({id:songId+':mini', conceptId:songId+':concept:mini', family:'mini_music_video' as const, songId, productionBurden:0.65, evidenceRefs:[]}),
    Object.freeze({id:songId+':location', conceptId:songId+':concept:location', family:'location_performance' as const, songId, productionBurden:0.25, evidenceRefs:[]}),
    Object.freeze({id:songId+':platform', conceptId:songId+':concept:platform', family:'performance_platform' as const, songId, productionBurden:0.35, evidenceRefs:[]}),
  ]);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
