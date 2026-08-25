/**
 * Identity discovery contracts.
 * Evidence may corroborate a candidate; it never establishes legal entitlement.
 */

const SOURCE_CLASSES = Object.freeze([
  'OFFICIAL_GOVERNMENT',
  'PUBLIC_RECORD',
  'AUTHORIZED_PROVIDER',
  'PUBLIC_WEB',
  'PUBLIC_SOCIAL',
  'USER_PROVIDED',
]);

const CONTACT_TYPES = Object.freeze(['phone', 'email', 'address', 'social', 'website']);

const CANDIDATE_STATES = Object.freeze(['CANDIDATE', 'REVIEW_REQUIRED', 'VERIFIED', 'REJECTED']);

function assertSourceClass(value) {
  if (!SOURCE_CLASSES.includes(value)) throw new Error(`Unsupported source class: ${value}`);
}

function normalizeEvidence(input) {
  if (!input || !input.source) throw new Error('Evidence requires source');
  assertSourceClass(input.sourceClass);
  return {
    id: input.id || null,
    source: input.source,
    sourceClass: input.sourceClass,
    sourceRecordId: input.sourceRecordId || null,
    observedIdentifiers: Array.isArray(input.observedIdentifiers) ? input.observedIdentifiers : [],
    observedAt: input.observedAt || null,
    freshnessDays: Number.isFinite(input.freshnessDays) ? input.freshnessDays : null,
    reliability: Number.isFinite(input.reliability) ? input.reliability : 0,
    provenance: input.provenance || null,
    notes: input.notes || null,
  };
}

function normalizeContact(input) {
  if (!input || !CONTACT_TYPES.includes(input.type)) throw new Error(`Unsupported contact type: ${input?.type}`);
  return {
    type: input.type,
    value: input.value,
    source: input.source || null,
    sourceClass: input.sourceClass || null,
    observedAt: input.observedAt || null,
    freshnessDays: Number.isFinite(input.freshnessDays) ? input.freshnessDays : null,
    corroborationCount: Number.isFinite(input.corroborationCount) ? input.corroborationCount : 0,
    confidence: Number.isFinite(input.confidence) ? input.confidence : 0,
    outreachVerificationStatus: input.outreachVerificationStatus || 'UNVERIFIED',
  };
}

module.exports = {
  SOURCE_CLASSES,
  CONTACT_TYPES,
  CANDIDATE_STATES,
  normalizeEvidence,
  normalizeContact,
};
