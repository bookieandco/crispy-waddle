/**
 * Canonical workflow contract for running OverageOS identity discovery in n8n.
 * This is a data contract, not an exported n8n credential or executable workflow.
 */

function buildIdentityWorkflowInput(record) {
  return {
    recordId: record.recordId,
    claimantName: record.claimantName,
    parcelId: record.parcelId,
    propertyAddress: record.propertyAddress,
    sourceUrl: record.sourceUrl,
    acquisitionPolicy: record.acquisitionPolicy || null,
    gates: {
      identityDecision: 'NOT_DETERMINED',
      entitlementDecision: 'NOT_DETERMINED',
      outreachDecision: 'BLOCKED',
    },
  };
}

const workflowStages = [
  'LOAD_CANONICAL_RECORD',
  'QUERY_APIVAULT_BY_NAME_OR_ADDRESS',
  'NORMALIZE_OBSERVATIONS',
  'CORROBORATE_WITH_PARCEL_AND_ASSESSOR',
  'OPTIONAL_PUBLIC_PROFILE_CORROBORATION',
  'RANK_CANDIDATES',
  'HUMAN_REVIEW',
  'ENTITLEMENT_VERIFICATION',
  'OUTREACH_POLICY_GATE',
];

module.exports = { buildIdentityWorkflowInput, workflowStages };
