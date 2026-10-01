import type {
  ArtistCommand,
  BreakoutSignal,
  BreakoutWindow,
  CityDemand,
  ContentExperiment,
  CreativeOutlier,
  JuggernautMode,
  JuggernautSnapshot,
  PerformanceObservation,
  PromotionBudget,
  RightsRecord,
  SongRecord,
  SpendDecision,
  VenueRecommendation,
} from './domain.js';

export interface OutlierBaseline {
  medianViews: number;
  medianSongActions: number;
  medianDirectFanCaptures: number;
  minimumExposures: number;
}

export function detectCreativeOutlier(
  observation: PerformanceObservation,
  baseline: OutlierBaseline,
): CreativeOutlier {
  assertObservation(observation);
  if (observation.exposures < baseline.minimumExposures) {
    return freezeOutlier(observation.experimentId, 0, 0, 'insufficient_sample', ['Minimum sample not reached.'], observation.evidenceRefs);
  }

  const viewLift = lift(observation.views, baseline.medianViews);
  const actionLift = lift(observation.songActions, baseline.medianSongActions);
  const captureLift = lift(observation.directFanCaptures, baseline.medianDirectFanCaptures);
  const relativeLift = round((viewLift + (actionLift * 2) + (captureLift * 3)) / 6);
  const quality = round((1 - observation.botRisk) * observation.attributionConfidence);
  const confidence = round(Math.min(1, quality * Math.min(1, observation.exposures / Math.max(baseline.minimumExposures * 3, 1))));
  const validated = relativeLift >= 1.5 && confidence >= 0.6;
  const interesting = relativeLift >= 1.15 && confidence >= 0.35;
  const reasons = [
    'Views lift=' + viewLift,
    'Song-action lift=' + actionLift,
    'Direct-fan lift=' + captureLift,
    'Data quality=' + quality,
  ];
  return freezeOutlier(
    observation.experimentId,
    relativeLift,
    confidence,
    validated ? 'validated' : interesting ? 'interesting' : 'insufficient_sample',
    reasons,
    observation.evidenceRefs,
  );
}

export function consolidateCreativeOutliers(outliers: readonly CreativeOutlier[]): readonly CreativeOutlier[] {
  const groups = new Map<string, CreativeOutlier[]>();
  for (const outlier of outliers) {
    const values = groups.get(outlier.experimentId) ?? [];
    values.push(outlier);
    groups.set(outlier.experimentId, values);
  }
  return Object.freeze([...groups.entries()].map(([experimentId, values]) => {
    const strong = values.filter((item) => item.status === 'validated');
    const interesting = values.filter((item) => item.status === 'interesting' || item.status === 'validated');
    const replicationCount = strong.length;
    const relativeLift = round(medianNumber(values.map((item) => item.relativeLift)));
    const confidence = round(Math.min(1, medianNumber(values.map((item) => item.confidence)) * Math.min(1, values.length / 2)));
    const status: CreativeOutlier['status'] =
      replicationCount >= 2 && confidence >= 0.6 ? 'validated'
      : interesting.length ? 'interesting'
      : 'insufficient_sample';
    return Object.freeze({
      experimentId,
      relativeLift,
      confidence,
      replicationCount,
      status,
      reasons: Object.freeze([
        'Replicated strong observations=' + replicationCount,
        'Observed samples=' + values.length,
        ...unique(values.flatMap((item) => item.reasons)),
      ]),
      evidenceRefs: Object.freeze(unique(values.flatMap((item) => item.evidenceRefs))),
    });
  }));
}

export function chooseJuggernautMode(input: {
  outliers: readonly CreativeOutlier[];
  breakoutSignals?: readonly BreakoutSignal[];
}): JuggernautMode {
  const validatedOutlier = input.outliers.some((item) => item.status === 'validated' && item.replicationCount >= 2);
  const breakout = (input.breakoutSignals ?? []).some((item) => item.strength >= 0.65);
  return validatedOutlier || breakout ? 'ATTACK' : 'SEARCH';
}

export function openBreakoutWindow(input: {
  songId: string;
  signals: readonly BreakoutSignal[];
  openedAt: string;
}): BreakoutWindow {
  requireText(input.songId, 'songId');
  if (!input.signals.length) throw new Error('MUSIC_JUGGERNAUT_BREAKOUT_SIGNAL_REQUIRED');
  const strength = Math.max(...input.signals.map((signal) => signal.strength));
  if (strength < 0.65) throw new Error('MUSIC_JUGGERNAUT_BREAKOUT_SIGNAL_TOO_WEAK');
  if (!Number.isFinite(Date.parse(input.openedAt))) throw new Error('MUSIC_JUGGERNAUT_BREAKOUT_DATE_INVALID');
  return Object.freeze({
    songId: input.songId,
    openedAt: input.openedAt,
    state: 'OPEN',
    signals: Object.freeze([...input.signals]),
    priorities: Object.freeze([
      'Feed the winning creative without fabricating social proof.',
      'Prepare the next music/content follow-up now.',
      'Capture fan demand into consented direct channels.',
      'Collect real UGC, creator, DJ, press, and city evidence.',
      'Map rights, partner, promoter, and collaborator opportunities.',
      'Preserve a breakout budget reserve until evidence supports scale.',
    ]),
    evidenceRefs: Object.freeze(unique(input.signals.flatMap((signal) => signal.evidenceRefs))),
  });
}

export function decidePromotionSpend(input: {
  budget: PromotionBudget;
  mode: JuggernautMode;
  outlier?: CreativeOutlier;
  rights?: RightsRecord;
  requestedMinor: number;
  preAuthorizedLimitMinor: number;
}): SpendDecision {
  assertBudget(input.budget);
  if (!Number.isFinite(input.requestedMinor) || input.requestedMinor < 0) throw new Error('MUSIC_JUGGERNAUT_SPEND_INVALID');
  if (!Number.isFinite(input.preAuthorizedLimitMinor) || input.preAuthorizedLimitMinor < 0) {
    throw new Error('MUSIC_JUGGERNAUT_PREAUTH_INVALID');
  }
  const available = Math.max(0, input.budget.approvedMinor - input.budget.spentMinor);
  const evidenceRefs = unique(input.outlier?.evidenceRefs ?? []);

  if (input.rights && isRightsBlocked(input.rights)) {
    return decision('STOP', 0, ['Rights state blocks commercial amplification.'], input.rights.evidenceRefs, true);
  }
  if (input.mode === 'SEARCH') {
    const micro = Math.min(input.requestedMinor, input.budget.experimentReserveMinor, input.preAuthorizedLimitMinor, available);
    return decision(
      micro > 0 ? 'MICRO_TEST' : 'HOLD',
      micro,
      ['Search mode preserves capital and only permits bounded learning spend.'],
      evidenceRefs,
      input.requestedMinor > input.preAuthorizedLimitMinor,
    );
  }
  if (!input.outlier || input.outlier.status !== 'validated' || input.outlier.replicationCount < 2) {
    return decision('HOLD', 0, ['Attack mode requires a replicated validated signal before scaling spend.'], evidenceRefs, false);
  }
  const scale = Math.min(
    input.requestedMinor,
    input.budget.breakoutReserveMinor + input.budget.experimentReserveMinor,
    input.preAuthorizedLimitMinor,
    available,
  );
  return decision(
    scale > 0 ? 'CONTROLLED_SCALE' : 'HOLD',
    scale,
    ['Validated signal permits controlled scale inside existing authorization.'],
    evidenceRefs,
    input.requestedMinor > input.preAuthorizedLimitMinor,
  );
}

export function recommendVenueCapacity(demand: CityDemand): VenueRecommendation {
  requireText(demand.city, 'city');
  requireEvidence(demand.evidenceRefs, 'city demand');
  const weighted = demand.directFans + demand.showInterest + (demand.priorAttendees * 1.5) + (demand.repeatFans * 2);
  const conservative = Math.max(25, Math.floor(weighted * 0.55));
  const commonCapacities = [25, 50, 75, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000];
  const recommendedCapacity = commonCapacities.find((capacity) => capacity >= conservative)
    ?? commonCapacities[commonCapacities.length - 1]!;
  const evidenceVolume = demand.directFans + demand.showInterest + demand.priorAttendees;
  return Object.freeze({
    city: demand.city,
    recommendedCapacity,
    confidence: round(Math.min(1, evidenceVolume / Math.max(recommendedCapacity, 1))),
    reasons: Object.freeze([
      'Capacity is sized from demonstrated local demand rather than headline listener count.',
      'Repeat fans and prior attendance receive more weight than passive listeners.',
    ]),
    authority: 'ANALYSIS_ONLY',
  });
}

export function buildDailyArtistQueue(snapshot: JuggernautSnapshot): readonly ArtistCommand[] {
  const commands: ArtistCommand[] = [];
  const activeExperiments = snapshot.experiments.filter((experiment) => experiment.status === 'running');
  const topSong = rankSongs(snapshot.songs, snapshot.observations, snapshot.experiments)[0];

  if (snapshot.mode === 'SEARCH') {
    commands.push(command(1, 'create', 'Create two genuinely different low-burden tests today.', 'Search mode needs information, not polish.', activeExperiments.flatMap((item) => item.evidenceRefs)));
  } else {
    commands.push(command(1, 'create', 'Create a family of variants around the validated winner.', 'Attack mode concentrates on evidence-backed creative.', snapshot.breakout?.evidenceRefs ?? []));
  }
  if (topSong) {
    commands.push(command(2, 'catalog', 'Keep ' + topSong.title + ' in the active decision set.', 'Current evidence ranks it highest among available songs.', topSong.evidenceRefs));
  }
  const repeatFans = snapshot.fans.filter((fan) => fan.repeatInteractions >= 3 && fan.stage !== 'VIEWER');
  if (repeatFans.length) {
    commands.push(command(3, 'fan', 'Review ' + repeatFans.length + ' repeat supporter(s) for genuine human follow-up.', 'Repeat supporters should not be ignored while chasing strangers.', unique(repeatFans.flatMap((fan) => fan.evidenceRefs))));
  }
  const topCity = [...snapshot.cityDemand].sort((a, b) => demandScore(b) - demandScore(a))[0];
  if (topCity) {
    const venue = recommendVenueCapacity(topCity);
    commands.push(command(4, 'live', 'Evaluate a roughly ' + venue.recommendedCapacity + '-capacity room in ' + topCity.city + '.', 'Local demand supports a bounded live test.', topCity.evidenceRefs));
  }
  const remaining = Math.max(0, snapshot.budget.approvedMinor - snapshot.budget.spentMinor);
  commands.push(command(5, 'money', 'Preserve ' + remaining + ' ' + snapshot.budget.currency + ' minor units of unspent approved capital until evidence earns deployment.', 'Available budget is not a spending obligation.', []));
  return Object.freeze(commands.sort((a, b) => a.priority - b.priority).slice(0, 5));
}

export function rankSongs(
  songs: readonly SongRecord[],
  observations: readonly PerformanceObservation[],
  experiments: readonly ContentExperiment[],
): readonly SongRecord[] {
  const scoreBySong = new Map<string, number>();
  const experimentSong = new Map(experiments.map((experiment) => [experiment.id, experiment.songId]));
  for (const observation of observations) {
    const songId = experimentSong.get(observation.experimentId);
    if (!songId) continue;
    const score =
      observation.songActions * 4 +
      observation.directFanCaptures * 8 +
      observation.saves * 2 +
      observation.shares * 1.5 +
      observation.profileVisits -
      observation.botRisk * Math.max(observation.views, 1);
    scoreBySong.set(songId, (scoreBySong.get(songId) ?? 0) + score * observation.attributionConfidence);
  }
  return Object.freeze([...songs].sort((a, b) => (scoreBySong.get(b.id) ?? 0) - (scoreBySong.get(a.id) ?? 0)));
}

export function validateExperimentPlan(experiment: ContentExperiment): ContentExperiment {
  requireText(experiment.id, 'experiment.id');
  requireText(experiment.songId, 'experiment.songId');
  requireText(experiment.hypothesis, 'experiment.hypothesis');
  requireText(experiment.contentFamily, 'experiment.contentFamily');
  requireText(experiment.platform, 'experiment.platform');
  if (!Number.isFinite(experiment.spendMinor) || experiment.spendMinor < 0) throw new Error('MUSIC_JUGGERNAUT_EXPERIMENT_SPEND_INVALID');
  if (!Number.isInteger(experiment.sampleTarget) || experiment.sampleTarget < 1) throw new Error('MUSIC_JUGGERNAUT_EXPERIMENT_SAMPLE_INVALID');
  requireText(experiment.successSignal, 'experiment.successSignal');
  requireText(experiment.failureSignal, 'experiment.failureSignal');
  return Object.freeze({...experiment, evidenceRefs: Object.freeze(unique(experiment.evidenceRefs))});
}

function isRightsBlocked(rights: RightsRecord): boolean {
  return !rights.masterOwnershipKnown
    || !rights.publishingKnown
    || rights.sampleStatus === 'review_required'
    || rights.sampleStatus === 'blocked'
    || rights.thirdPartyUsageStatus === 'review_required'
    || rights.thirdPartyUsageStatus === 'blocked';
}

function assertObservation(observation: PerformanceObservation): void {
  const numeric = [
    observation.exposures,
    observation.views,
    observation.shares,
    observation.saves,
    observation.comments,
    observation.profileVisits,
    observation.songActions,
    observation.directFanCaptures,
  ];
  if (numeric.some((value) => !Number.isFinite(value) || value < 0)) throw new Error('MUSIC_JUGGERNAUT_OBSERVATION_INVALID');
  assertRate(observation.botRisk, 'botRisk');
  assertRate(observation.attributionConfidence, 'attributionConfidence');
  requireEvidence(observation.evidenceRefs, 'performance observation');
}

function assertBudget(budget: PromotionBudget): void {
  const numeric = [budget.approvedMinor, budget.spentMinor, budget.experimentReserveMinor, budget.breakoutReserveMinor, budget.productionReserveMinor];
  if (numeric.some((value) => !Number.isFinite(value) || value < 0)) throw new Error('MUSIC_JUGGERNAUT_BUDGET_INVALID');
  if (budget.spentMinor > budget.approvedMinor) throw new Error('MUSIC_JUGGERNAUT_BUDGET_OVERRUN');
  requireText(budget.currency, 'budget.currency');
}

function freezeOutlier(
  experimentId: string,
  relativeLift: number,
  confidence: number,
  status: CreativeOutlier['status'],
  reasons: readonly string[],
  evidenceRefs: readonly string[],
): CreativeOutlier {
  return Object.freeze({
    experimentId,
    relativeLift,
    confidence,
    replicationCount: 1,
    status,
    reasons: Object.freeze([...reasons]),
    evidenceRefs: Object.freeze(unique(evidenceRefs)),
  });
}

function decision(
  action: SpendDecision['action'],
  authorizedMinor: number,
  reasons: readonly string[],
  evidenceRefs: readonly string[],
  requiresApproval: boolean,
): SpendDecision {
  return Object.freeze({
    action,
    authorizedMinor,
    reasons: Object.freeze([...reasons]),
    evidenceRefs: Object.freeze(unique(evidenceRefs)),
    requiresApproval,
  });
}

function command(
  priority: number,
  kind: ArtistCommand['kind'],
  instruction: string,
  reason: string,
  evidenceRefs: readonly string[],
): ArtistCommand {
  return Object.freeze({priority, kind, instruction, reason, evidenceRefs: Object.freeze(unique(evidenceRefs))});
}

function lift(actual: number, baseline: number): number {
  if (baseline <= 0) return actual > 0 ? 2 : 1;
  return round(actual / baseline);
}

function demandScore(demand: CityDemand): number {
  return demand.directFans * 3 + demand.showInterest * 2 + demand.priorAttendees * 4 + demand.repeatFans * 5 + demand.listeners * 0.1;
}

function assertRate(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('MUSIC_JUGGERNAUT_RATE_INVALID:' + field);
}

function requireEvidence(values: readonly string[], field: string): void {
  if (!values.length || values.some((value) => !value.trim())) throw new Error('MUSIC_JUGGERNAUT_EVIDENCE_REQUIRED:' + field);
}

function requireText(value: string, field: string): void {
  if (!value?.trim()) throw new Error('MUSIC_JUGGERNAUT_TEXT_REQUIRED:' + field);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function medianNumber(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle] ?? 0
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
