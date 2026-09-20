import type {
  EvidenceQuality,
  EvidenceRef,
} from './financial-intelligence-contracts.js';
import type {
  DecisionAssessment,
  DecisionCase,
} from './decision-workflow-contracts.js';

export const SPORTS_MONEY_BRIDGE_VERSION = 'SPORT-MONEY-01' as const;
export const SUPPORTED_SPORTS_PREDICTION_SCHEMA_VERSION = 'SPORT-PRED-01' as const;

export type SportsPredictionTransportEnvelope = Readonly<{
  schemaVersion: typeof SUPPORTED_SPORTS_PREDICTION_SCHEMA_VERSION;
  envelopeId: string;
  sport: string;
  subject: Readonly<{
    subjectId: string;
    kind: string;
    gameId?: string;
  }>;
  informationCutoff: string;
  issuedAt: string;
  model: Readonly<{
    modelId: string;
    modelVersion: string;
    methodologyVersion: string;
    featureSnapshotHash: string;
    codeRevision?: string;
  }>;
  distribution: Readonly<{
    outcomes: readonly Readonly<{
      outcomeId: string;
      label: string;
      probability: number;
      metadata?: Readonly<Record<string, string | number | boolean>>;
    }>[];
  }>;
  calibration: Readonly<{
    status: string;
    sampleSize: number;
    brierScore?: number;
    evaluatedAt?: string;
    calibrationModelVersion?: string;
  }>;
  uncertainty: Readonly<{
    aleatoric: number;
    epistemic: number;
    overall: number;
    notes?: readonly string[];
  }>;
  resolution: Readonly<{
    type: string;
    authority: string;
    ruleVersion: string;
    resolutionDeadlineAt?: string;
  }>;
  evidenceRefs: readonly Readonly<{
    evidenceId: string;
    sourceType: string;
    locator?: string;
    observedAt?: string;
  }>[];
  provenance: Readonly<{
    inputSnapshotHash: string;
    evidenceSnapshotHash: string;
    generatedBy: string;
    sourceEnvelopeIds?: readonly string[];
  }>;
  allowedUses: readonly string[];
  authority: Readonly<{
    decision: 'INTELLIGENCE_ONLY';
    coachingExecution: 'NONE';
    bettingExecution: 'NONE';
    financialExecution: 'NONE';
  }>;
}>;

export type SportsResearchIngressContext = Readonly<{
  accountId: string;
  requestedBy: string;
  receivedAt: string;
  sourceNamespace: string;
  evidenceQuality: EvidenceQuality;
}>;

export type SportsMoneyResearchArtifact = Readonly<{
  bridgeVersion: typeof SPORTS_MONEY_BRIDGE_VERSION;
  sourceSchemaVersion: typeof SUPPORTED_SPORTS_PREDICTION_SCHEMA_VERSION;
  sourceEnvelopeId: string;
  sport: string;
  subjectId: string;
  informationCutoff: string;
  issuedAt: string;
  model: SportsPredictionTransportEnvelope['model'];
  distribution: SportsPredictionTransportEnvelope['distribution'];
  calibration: SportsPredictionTransportEnvelope['calibration'];
  uncertainty: SportsPredictionTransportEnvelope['uncertainty'];
  resolution: SportsPredictionTransportEnvelope['resolution'];
  evidence: readonly EvidenceRef[];
  sourceProvenance: SportsPredictionTransportEnvelope['provenance'];
  decisionCase: DecisionCase;
  assessment: DecisionAssessment;
  bettingAuthority: 'NONE';
  financialAuthority: 'NONE';
}>;

const EPSILON = 1e-6;

function nonEmpty(value: string, code: string): void {
  if (!value.trim()) throw new Error(code);
}

function iso(value: string, code: string): void {
  nonEmpty(value, code);
  if (Number.isNaN(Date.parse(value))) throw new Error(code);
}

function unitInterval(value: number, code: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(code);
  }
}

export function assertSportsPredictionResearchIngress(
  envelope: SportsPredictionTransportEnvelope,
  context: SportsResearchIngressContext,
): void {
  if (envelope.schemaVersion !== SUPPORTED_SPORTS_PREDICTION_SCHEMA_VERSION) {
    throw new Error('MONEY_SPORTS_SCHEMA_VERSION_UNSUPPORTED');
  }

  if (!envelope.allowedUses.includes('MONEY_RESEARCH_INPUT')) {
    throw new Error('MONEY_SPORTS_RESEARCH_USE_NOT_ALLOWED');
  }

  if (
    envelope.authority.decision !== 'INTELLIGENCE_ONLY' ||
    envelope.authority.coachingExecution !== 'NONE' ||
    envelope.authority.bettingExecution !== 'NONE' ||
    envelope.authority.financialExecution !== 'NONE'
  ) {
    throw new Error('MONEY_SPORTS_EXECUTION_AUTHORITY_FORBIDDEN');
  }

  nonEmpty(envelope.envelopeId, 'MONEY_SPORTS_ENVELOPE_ID_REQUIRED');
  nonEmpty(envelope.subject.subjectId, 'MONEY_SPORTS_SUBJECT_ID_REQUIRED');
  nonEmpty(envelope.model.modelId, 'MONEY_SPORTS_MODEL_ID_REQUIRED');
  nonEmpty(envelope.model.modelVersion, 'MONEY_SPORTS_MODEL_VERSION_REQUIRED');
  nonEmpty(
    envelope.model.methodologyVersion,
    'MONEY_SPORTS_METHODOLOGY_VERSION_REQUIRED',
  );
  nonEmpty(
    envelope.model.featureSnapshotHash,
    'MONEY_SPORTS_FEATURE_SNAPSHOT_REQUIRED',
  );
  nonEmpty(
    envelope.provenance.inputSnapshotHash,
    'MONEY_SPORTS_INPUT_SNAPSHOT_REQUIRED',
  );
  nonEmpty(
    envelope.provenance.evidenceSnapshotHash,
    'MONEY_SPORTS_EVIDENCE_SNAPSHOT_REQUIRED',
  );
  nonEmpty(
    envelope.provenance.generatedBy,
    'MONEY_SPORTS_GENERATOR_REQUIRED',
  );
  nonEmpty(
    envelope.resolution.authority,
    'MONEY_SPORTS_RESOLUTION_AUTHORITY_REQUIRED',
  );
  nonEmpty(
    envelope.resolution.ruleVersion,
    'MONEY_SPORTS_RESOLUTION_RULE_REQUIRED',
  );

  iso(envelope.informationCutoff, 'MONEY_SPORTS_INFORMATION_CUTOFF_INVALID');
  iso(envelope.issuedAt, 'MONEY_SPORTS_ISSUED_AT_INVALID');
  iso(context.receivedAt, 'MONEY_SPORTS_RECEIVED_AT_INVALID');

  if (Date.parse(envelope.informationCutoff) > Date.parse(envelope.issuedAt)) {
    throw new Error('MONEY_SPORTS_FUTURE_INFORMATION_CUTOFF');
  }
  if (Date.parse(context.receivedAt) < Date.parse(envelope.issuedAt)) {
    throw new Error('MONEY_SPORTS_RECEIVED_BEFORE_ISSUED');
  }

  nonEmpty(context.accountId, 'MONEY_SPORTS_ACCOUNT_ID_REQUIRED');
  nonEmpty(context.requestedBy, 'MONEY_SPORTS_REQUESTED_BY_REQUIRED');
  nonEmpty(context.sourceNamespace, 'MONEY_SPORTS_SOURCE_NAMESPACE_REQUIRED');

  if (envelope.distribution.outcomes.length === 0) {
    throw new Error('MONEY_SPORTS_DISTRIBUTION_EMPTY');
  }

  const outcomeIds = new Set<string>();
  let probabilityMass = 0;
  for (const outcome of envelope.distribution.outcomes) {
    nonEmpty(outcome.outcomeId, 'MONEY_SPORTS_OUTCOME_ID_REQUIRED');
    nonEmpty(outcome.label, 'MONEY_SPORTS_OUTCOME_LABEL_REQUIRED');
    unitInterval(outcome.probability, 'MONEY_SPORTS_PROBABILITY_INVALID');
    if (outcomeIds.has(outcome.outcomeId)) {
      throw new Error('MONEY_SPORTS_DUPLICATE_OUTCOME');
    }
    outcomeIds.add(outcome.outcomeId);
    probabilityMass += outcome.probability;
  }
  if (Math.abs(probabilityMass - 1) > EPSILON) {
    throw new Error('MONEY_SPORTS_PROBABILITY_MASS_INVALID');
  }

  if (
    !Number.isInteger(envelope.calibration.sampleSize) ||
    envelope.calibration.sampleSize < 0
  ) {
    throw new Error('MONEY_SPORTS_CALIBRATION_SAMPLE_INVALID');
  }
  if (
    envelope.calibration.brierScore !== undefined &&
    (!Number.isFinite(envelope.calibration.brierScore) ||
      envelope.calibration.brierScore < 0)
  ) {
    throw new Error('MONEY_SPORTS_BRIER_SCORE_INVALID');
  }

  unitInterval(
    envelope.uncertainty.aleatoric,
    'MONEY_SPORTS_ALEATORIC_UNCERTAINTY_INVALID',
  );
  unitInterval(
    envelope.uncertainty.epistemic,
    'MONEY_SPORTS_EPISTEMIC_UNCERTAINTY_INVALID',
  );
  unitInterval(
    envelope.uncertainty.overall,
    'MONEY_SPORTS_OVERALL_UNCERTAINTY_INVALID',
  );

  if (envelope.evidenceRefs.length === 0) {
    throw new Error('MONEY_SPORTS_EVIDENCE_REQUIRED');
  }

  const evidenceIds = new Set<string>();
  for (const evidence of envelope.evidenceRefs) {
    nonEmpty(evidence.evidenceId, 'MONEY_SPORTS_EVIDENCE_ID_REQUIRED');
    nonEmpty(evidence.sourceType, 'MONEY_SPORTS_EVIDENCE_SOURCE_REQUIRED');
    if (evidenceIds.has(evidence.evidenceId)) {
      throw new Error('MONEY_SPORTS_DUPLICATE_EVIDENCE');
    }
    evidenceIds.add(evidence.evidenceId);

    if (!evidence.observedAt) {
      throw new Error('MONEY_SPORTS_EVIDENCE_OBSERVED_AT_REQUIRED');
    }
    iso(evidence.observedAt, 'MONEY_SPORTS_EVIDENCE_OBSERVED_AT_INVALID');
    if (Date.parse(evidence.observedAt) > Date.parse(envelope.informationCutoff)) {
      throw new Error('MONEY_SPORTS_EVIDENCE_AFTER_INFORMATION_CUTOFF');
    }
  }
}

function toMoneyEvidence(
  envelope: SportsPredictionTransportEnvelope,
  context: SportsResearchIngressContext,
): readonly EvidenceRef[] {
  return Object.freeze(
    envelope.evidenceRefs.map((evidence) =>
      Object.freeze({
        evidenceId: evidence.evidenceId,
        sourceId: `${context.sourceNamespace}:${evidence.sourceType}`,
        observedAt: evidence.observedAt!,
        receivedAt: context.receivedAt,
        quality: context.evidenceQuality,
        inputHash: envelope.provenance.evidenceSnapshotHash,
      }),
    ),
  );
}

export function ingestSportsPredictionResearch(
  envelope: SportsPredictionTransportEnvelope,
  context: SportsResearchIngressContext,
): SportsMoneyResearchArtifact {
  assertSportsPredictionResearchIngress(envelope, context);

  const evidence = toMoneyEvidence(envelope, context);
  const decisionCase: DecisionCase = Object.freeze({
    caseId: `sports:${envelope.envelopeId}`,
    accountId: context.accountId,
    subjectId: envelope.subject.subjectId,
    requestedBy: context.requestedBy,
    informationCutoff: envelope.informationCutoff,
    createdAt: context.receivedAt,
    status: 'RESEARCH_ONLY',
    provenanceHash: envelope.provenance.evidenceSnapshotHash,
  });

  const assessment: DecisionAssessment = Object.freeze({
    caseId: decisionCase.caseId,
    evidenceStatus: 'INGESTED',
    freshnessStatus: 'UNEVALUATED',
    riskStatus: 'UNEVALUATED',
    stressStatus: 'UNEVALUATED',
    simulationStatus: 'UNEVALUATED',
    liquidityStatus: 'UNEVALUATED',
    calibrationStatus: envelope.calibration.status,
    authorityStatus: 'MISSING',
    disposition: 'RESEARCH_ONLY',
  });

  return Object.freeze({
    bridgeVersion: SPORTS_MONEY_BRIDGE_VERSION,
    sourceSchemaVersion: SUPPORTED_SPORTS_PREDICTION_SCHEMA_VERSION,
    sourceEnvelopeId: envelope.envelopeId,
    sport: envelope.sport,
    subjectId: envelope.subject.subjectId,
    informationCutoff: envelope.informationCutoff,
    issuedAt: envelope.issuedAt,
    model: Object.freeze({ ...envelope.model }),
    distribution: Object.freeze({
      outcomes: Object.freeze(
        envelope.distribution.outcomes.map((outcome) =>
          Object.freeze({
            ...outcome,
            metadata: outcome.metadata
              ? Object.freeze({ ...outcome.metadata })
              : undefined,
          }),
        ),
      ),
    }),
    calibration: Object.freeze({ ...envelope.calibration }),
    uncertainty: Object.freeze({
      ...envelope.uncertainty,
      notes: envelope.uncertainty.notes
        ? Object.freeze([...envelope.uncertainty.notes])
        : undefined,
    }),
    resolution: Object.freeze({ ...envelope.resolution }),
    evidence,
    sourceProvenance: Object.freeze({
      ...envelope.provenance,
      sourceEnvelopeIds: envelope.provenance.sourceEnvelopeIds
        ? Object.freeze([...envelope.provenance.sourceEnvelopeIds])
        : undefined,
    }),
    decisionCase,
    assessment,
    bettingAuthority: 'NONE',
    financialAuthority: 'NONE',
  });
}

export function assertSportsMoneyResearchOnly(
  artifact: SportsMoneyResearchArtifact,
): void {
  if (
    artifact.bridgeVersion !== SPORTS_MONEY_BRIDGE_VERSION ||
    artifact.sourceSchemaVersion !== SUPPORTED_SPORTS_PREDICTION_SCHEMA_VERSION
  ) {
    throw new Error('MONEY_SPORTS_BRIDGE_VERSION_INVALID');
  }
  if (
    artifact.assessment.disposition !== 'RESEARCH_ONLY' ||
    artifact.assessment.authorityStatus !== 'MISSING' ||
    artifact.bettingAuthority !== 'NONE' ||
    artifact.financialAuthority !== 'NONE'
  ) {
    throw new Error('MONEY_SPORTS_RESEARCH_ONLY_BOUNDARY_VIOLATED');
  }
}
