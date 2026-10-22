type Row = Record<string, unknown>;
export type RecoveryStageId =
  | 'MUSIC-JUGGERNAUT.RECOVER.01'
  | 'MUSIC-JUGGERNAUT.RECOVER.02'
  | 'MUSIC-JUGGERNAUT.RECOVER.03'
  | 'MUSIC-JUGGERNAUT.RECOVER.04'
  | 'MUSIC-JUGGERNAUT.RECOVER.05'
  | 'MUSIC-JUGGERNAUT.RECOVER.06'
  | 'MUSIC-JUGGERNAUT.RECOVER.07'
  | 'MUSIC-JUGGERNAUT.RECOVER.08';

export interface MusicRecoveryEvidence {
  project: Row | null;
  songs: readonly Row[];
  experiments: readonly Row[];
  observations: readonly Row[];
  rights: readonly Row[];
  learning: readonly Row[];
  platformAccounts: readonly Row[];
  catalogReleases: readonly Row[];
  royaltySnapshots: readonly Row[];
  /** Null means no reliable owner-scoped read was possible; never treat as zero. */
  socialAccounts: readonly Row[] | null;
  /** Null means not independently inspected, not "no publication". */
  musicSocialLineage: readonly Row[] | null;
  directorApprovedForMusic: readonly Row[] | null;
  verifiedProviderReadbacks: readonly Row[] | null;
  independentPhoneAcceptance: readonly Row[] | null;
}
export interface MusicRecoveryStage {
  id: RecoveryStageId;
  label: string;
  state: 'data_ready' | 'blocked' | 'unverified';
  evidence: readonly string[];
  blockers: readonly string[];
  /** This is a readiness audit, NOT a grant of execution authority. */
  authority: 'READ_ONLY_DIAGNOSTIC';
}
export interface MusicRecoveryAssessment {
  version: 'MUSIC-JUGGERNAUT.RECOVER.01-08-v1';
  artistKey: 'atwood-bookie';
  counts: {
    songs: number; releases: number; sectionsReady: number;
    experiments: number; attributableExperiments: number;
    observations: number; validatedLearning: number;
    rightsCleared: number; royaltySnapshots: number;
    catalogReferences: number;
  };
  stages: readonly MusicRecoveryStage[];
  complete: boolean;
  liveCampaignCertified: false | true;
  externalActionsStarted: false;
}

function arr(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function refs(row: Row): string[] {
  return arr(row.evidence_refs).filter((x): x is string => typeof x === 'string' && x.length > 0);
}
function isApprovedRights(row: Row): boolean {
  return row.master_ownership_known === true && row.publishing_known === true &&
    ['cleared', 'none'].includes(String(row.sample_status)) &&
    ['cleared', 'none'].includes(String(row.third_party_usage_status)) && refs(row).length > 0;
}
function validSection(row: Row): boolean {
  return arr(row.sections).some((part) => {
    if (!part || typeof part !== 'object') return false;
    const s = part as Row;
    const start = Number(s.startMs ?? s.start_ms);
    const end = Number(s.endMs ?? s.end_ms);
    return Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start &&
      arr(s.functions).length > 0;
  });
}
function stage(id: RecoveryStageId, label: string, ok: boolean | null, evidence: string[], blockers: string[]): MusicRecoveryStage {
  return Object.freeze({
    id, label, state: ok === null ? 'unverified' as const : ok ? 'data_ready' as const : 'blocked' as const,
    evidence: Object.freeze(evidence), blockers: Object.freeze(blockers),
    authority: 'READ_ONLY_DIAGNOSTIC' as const,
  });
}
function title(row: Row): string { return String(row.title ?? row.song_key ?? row.id ?? '?'); }
function hasOwnProof(rows: readonly Row[] | null): boolean | null {
  if (rows === null) return null;
  return rows.some(row => row.user_id && row.project_id && refs(row).length > 0);
}

/**
 * Report the eight recovery gates without "completing" anything on synthetic
 * certification receipts, catalog-only identities, staging experiments, or
 * unverified provider statuses. No API call, write, spend or publish is made.
 */
export function buildMusicJuggernautRecovery(input: MusicRecoveryEvidence): MusicRecoveryAssessment {
  const projectOk = Boolean(input.project?.id && input.project?.artist_key === 'atwood-bookie');
  const songIds = new Set(input.songs.map(s => String(s.id)));
  const rightsCleared = input.rights.filter(isApprovedRights);
  const sectionSongs = input.songs.filter(validSection);
  const linkedRights = new Set(rightsCleared.map(r => String(r.asset_key)));
  const candidate = input.songs.find(s =>
    validSection(s) && s.rights_state === 'clear' && linkedRights.has(String(s.song_key)));
  const connected = input.socialAccounts?.filter(row => row.status === 'connected' && row.id) ?? [];
  const provider = new Set(connected.map(row => String(row.platform ?? row.provider ?? '')));
  const attributable = input.experiments.filter(row =>
    songIds.has(String(row.song_id)) && row.platform && row.platform !== 'cross-platform-staging' &&
    provider.has(String(row.platform)) && !['cancelled', 'rejected'].includes(String(row.status)));
  const attributableIds = new Set(attributable.map(row => String(row.id)));
  const eligibleObservations = input.observations.filter(row =>
    attributableIds.has(String(row.experiment_id)) && refs(row).length > 0 &&
    Number(row.attribution_confidence) >= 0.75 && Number(row.bot_risk) <= 0.25 &&
    Number(row.exposures) > 0);
  const observedExperimentIds = new Set(eligibleObservations.map(r => String(r.experiment_id)));
  const validated = input.learning.filter(row =>
    row.status === 'validated' && Number(row.confidence) >= 0.75 && refs(row).length > 0 &&
    typeof (row.reusable_signals as Row | null)?.experimentId === 'string' &&
    input.experiments.some(e =>
      (String(e.experiment_key) === String((row.reusable_signals as Row).experimentId) ||
       String(e.id) === String((row.reusable_signals as Row).experimentId)) &&
      observedExperimentIds.has(String(e.id)))
  );
  const completeSocial = input.verifiedProviderReadbacks === null ? null :
    input.verifiedProviderReadbacks.some(r =>
      ['published', 'delivered'].includes(String(r.status)) &&
      Boolean(r.provider_post_id ?? r.providerPostId) && refs(r).length > 0
    );
  // No count-based approval. An independent Music-linked asset approval is required.
  const directorProof = hasOwnProof(input.directorApprovedForMusic);
  const lineageProof = hasOwnProof(input.musicSocialLineage);
  const socialGate = (completeSocial === null || lineageProof === null) ? null : completeSocial && lineageProof;
  const phoneAcceptance = input.independentPhoneAcceptance === null ? null :
    input.independentPhoneAcceptance.some(r =>
      r.status === 'passed' && r.device === 'iphone' &&
      r.external_provider_readback_verified === true && refs(r).length > 0
    );

  const stages: MusicRecoveryStage[] = [
    stage('MUSIC-JUGGERNAUT.RECOVER.01','Canonical Music project',projectOk && input.songs.length > 0 && input.catalogReleases.length > 0,
      [projectOk ? 'project:atwood-bookie' : 'project:missing', 'catalog:songs:' + input.songs.length,
       'catalog:releases:' + input.catalogReleases.length],
      projectOk ? [] : ['OWNER_PROJECT_NOT_CONFIRMED']),
    stage('MUSIC-JUGGERNAUT.RECOVER.02','Rights-cleared song sections',Boolean(candidate),
      ['catalog:valid-section-songs:' + sectionSongs.length, 'rights:cleared:' + rightsCleared.length],
      candidate ? [] : ['NO_SINGLE_SONG_WITH_VERIFIED_RIGHTS_AND_REAL_SECTIONS']),
    stage('MUSIC-JUGGERNAUT.RECOVER.03','Social identity and rights', input.socialAccounts === null ? null : Boolean(candidate && connected.length),
      ['social:connected-accounts:' + connected.length, 'catalog:references:' + input.platformAccounts.length],
      connected.length ? (candidate ? [] : ['RIGHTS_REVIEW_REQUIRED']) : ['OWNER_SOCIAL_PROVIDER_CONNECTION_UNVERIFIED']),
    stage('MUSIC-JUGGERNAUT.RECOVER.04','Approved Director asset',directorProof,
      ['director:approval-readback:' + (input.directorApprovedForMusic?.length ?? 'unverified')],
      directorProof ? [] : ['MUSIC_LINKED_DIRECTOR_APPROVAL_NOT_VERIFIED']),
    stage('MUSIC-JUGGERNAUT.RECOVER.05','Social delivery and provider readback',socialGate,
      ['music:social-lineage:' + (input.musicSocialLineage?.length ?? 'unverified'),
       'social:provider-readbacks:' + (input.verifiedProviderReadbacks?.length ?? 'unverified')],
      socialGate ? [] : ['APPROVAL_RECEIPT_AND_REAL_PROVIDER_POST_READBACK_REQUIRED']),
    stage('MUSIC-JUGGERNAUT.RECOVER.06','Measured experiments and learning',
      eligibleObservations.length > 0 && validated.length > 0,
      ['music:attributable-experiments:' + attributable.length,
       'music:eligible-observations:' + eligibleObservations.length,
       'music:validated-learning:' + validated.length],
      validated.length ? [] : ['NO_REPLICATED_ATTRIBUTED_MUSIC_OUTCOME_ADMITTED']),
    stage('MUSIC-JUGGERNAUT.RECOVER.07','Fans and revenue evidence',
      input.royaltySnapshots.length > 0 && eligibleObservations.some(row => Number(row.direct_fan_captures) > 0),
      ['music:royalty-statements:' + input.royaltySnapshots.length,
       'music:qualified-direct-fan-events:' + eligibleObservations.filter(row => Number(row.direct_fan_captures) > 0).length],
      input.royaltySnapshots.length ? ['OWNER_FAN_ACQUISITION_EVIDENCE_REQUIRED'] : ['ROYALTY_STATEMENT_REQUIRED']),
    stage('MUSIC-JUGGERNAUT.RECOVER.08','Independent iPhone production acceptance',
      phoneAcceptance,
      ['acceptance:owner-iphone:' + (input.independentPhoneAcceptance?.length ?? 'unverified')],
      phoneAcceptance ? [] : ['INDEPENDENT_REAL_DEVICE_CANARY_REQUIRED']),
  ];
  const complete = stages.every(s => s.state === 'data_ready');
  return Object.freeze({
    version: 'MUSIC-JUGGERNAUT.RECOVER.01-08-v1' as const, artistKey: 'atwood-bookie' as const,
    counts: Object.freeze({
      songs: input.songs.length,releases:input.catalogReleases.length, sectionsReady: sectionSongs.length,
      experiments:input.experiments.length, attributableExperiments:attributable.length,
      observations:input.observations.length,validatedLearning:validated.length,
      rightsCleared:rightsCleared.length,royaltySnapshots:input.royaltySnapshots.length,
      catalogReferences:input.platformAccounts.length,
    }),
    stages: Object.freeze(stages), complete,
    liveCampaignCertified: complete && Boolean(phoneAcceptance) && Boolean(socialGate),
    externalActionsStarted: false as const,
  });
}
