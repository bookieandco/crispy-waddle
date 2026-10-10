import type { GrowthId } from '../domain/types.js';
import type {
  ArtistKernel,
  ContentExperiment,
  CreativeOutlier,
  JuggernautSnapshot,
  SongRecord,
} from '../music-juggernaut/domain.js';
import type { SocialPortfolioSubject } from './social-juggernaut.js';

export interface MusicJuggernautSocialInput {
  snapshot: JuggernautSnapshot;
  song: SongRecord;
  artistKernel: ArtistKernel;
  brandId: GrowthId;
  preferredSurfaces: readonly string[];
  evidenceQuality: number;
  contentReadiness: number;
  urgency: number;
  outliers?: readonly CreativeOutlier[];
}

export function musicJuggernautSongToSocialSubject(
  input: MusicJuggernautSocialInput,
): SocialPortfolioSubject {
  if (!input.snapshot.songs.some((song) => song.id === input.song.id)) {
    throw new Error('SOCIAL_JUGGERNAUT_MUSIC_SONG_NOT_IN_SNAPSHOT');
  }
  if (input.snapshot.artistId !== input.artistKernel.artistId) {
    throw new Error('SOCIAL_JUGGERNAUT_MUSIC_ARTIST_MISMATCH');
  }
  if (input.song.rightsState === 'blocked') {
    throw new Error('SOCIAL_JUGGERNAUT_MUSIC_RIGHTS_BLOCKED');
  }
  assertScore(input.evidenceQuality, 'evidenceQuality');
  assertScore(input.contentReadiness, 'contentReadiness');
  assertScore(input.urgency, 'urgency');

  const songExperiments = input.snapshot.experiments
    .filter((experiment) => experiment.songId === input.song.id);
  const validatedWinner = selectValidatedWinner(
    songExperiments,
    input.outliers ?? [],
  );

  const audienceSignals = unique([
    input.song.title,
    ...input.artistKernel.personalityTraits,
    ...input.artistKernel.tasteSignals,
    ...input.artistKernel.sonicSignatures,
    ...input.artistKernel.visualSignatures,
    ...input.song.sections.flatMap((section) => [
      section.label,
      ...section.functions,
    ]),
  ]);

  const evidenceRefs = unique([
    ...input.song.evidenceRefs,
    ...input.artistKernel.evidenceRefs,
    ...songExperiments.flatMap((experiment) => experiment.evidenceRefs),
    ...(validatedWinner?.outlier.evidenceRefs ?? []),
    ...(input.snapshot.breakout?.songId === input.song.id
      ? input.snapshot.breakout.evidenceRefs
      : []),
    `music-mode:${input.snapshot.mode}`,
    `music-rights:${input.song.rightsState}`,
  ]);

  const businessValue = round(
    input.song.artistConviction * 0.55
      + downstreamMusicValue(input.snapshot, input.song.id) * 0.45,
  );
  const learningValue = songExperiments.length === 0
    ? 95
    : validatedWinner
      ? 70
      : 85;

  return Object.freeze({
    id: `social-subject:music:${input.song.id}` as GrowthId,
    kind: 'music' as const,
    brandId: input.brandId,
    label: `${input.artistKernel.artistId} — ${input.song.title}`,
    audienceSignals: Object.freeze(audienceSignals),
    objectives: Object.freeze([
      'discovery',
      'music_transfer',
      'direct_capture',
      'relationship_depth',
    ] as const),
    preferredSurfaces: Object.freeze(unique(input.preferredSurfaces)),
    evidenceRefs: Object.freeze(evidenceRefs),
    scores: Object.freeze({
      businessValue,
      evidenceQuality: input.evidenceQuality,
      contentReadiness: input.contentReadiness,
      learningValue,
      urgency: input.urgency,
    }),
    ...(validatedWinner
      ? {
          validatedWinningMechanic: Object.freeze({
            id: `music-winner:${validatedWinner.experiment.id}`,
            evidenceRefs: Object.freeze(unique([
              ...validatedWinner.experiment.evidenceRefs,
              ...validatedWinner.outlier.evidenceRefs,
            ])),
          }),
        }
      : {}),
  });
}

function selectValidatedWinner(
  experiments: readonly ContentExperiment[],
  outliers: readonly CreativeOutlier[],
): { experiment: ContentExperiment; outlier: CreativeOutlier } | undefined {
  const byExperiment = new Map(experiments.map((experiment) => [experiment.id, experiment] as const));
  return outliers
    .filter((outlier) =>
      outlier.status === 'validated'
      && outlier.replicationCount >= 2
      && byExperiment.has(outlier.experimentId),
    )
    .map((outlier) => ({
      outlier,
      experiment: byExperiment.get(outlier.experimentId)!,
    }))
    .sort((a, b) =>
      (b.outlier.confidence * b.outlier.relativeLift)
      - (a.outlier.confidence * a.outlier.relativeLift),
    )[0];
}

function downstreamMusicValue(snapshot: JuggernautSnapshot, songId: string): number {
  const experimentIds = new Set(
    snapshot.experiments
      .filter((experiment) => experiment.songId === songId)
      .map((experiment) => experiment.id),
  );
  const observations = snapshot.observations
    .filter((observation) => experimentIds.has(observation.experimentId));

  if (!observations.length) return 50;

  const totalViews = observations.reduce((sum, observation) => sum + Math.max(0, observation.views), 0);
  const songActions = observations.reduce((sum, observation) => sum + Math.max(0, observation.songActions), 0);
  const directFans = observations.reduce((sum, observation) => sum + Math.max(0, observation.directFanCaptures), 0);
  const purchases = observations.reduce((sum, observation) => sum + Math.max(0, observation.purchases ?? 0), 0);

  if (totalViews <= 0) return 40;

  const transferRate = Math.min(1, songActions / totalViews);
  const fanRate = Math.min(1, directFans / totalViews);
  const purchaseRate = Math.min(1, purchases / totalViews);

  return round(Math.min(100,
    transferRate * 550
      + fanRate * 2500
      + purchaseRate * 5000,
  ));
}

function assertScore(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`SOCIAL_JUGGERNAUT_MUSIC_SCORE_INVALID:${field}`);
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function round(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
}
