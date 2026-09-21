export interface SampleEvidence {
  providerOrderId: string;
  receivedAt: string;
  approvedBy: string;
  inspection: {
    printPlacementPass: boolean;
    colorPass: boolean;
    materialPass: boolean;
    damageFree: boolean;
    notes?: string;
  };
}

export function validSampleEvidence(value: SampleEvidence | undefined): value is SampleEvidence {
  if (!value) return false;
  const receivedAt = Date.parse(value.receivedAt);
  if (
    !value.providerOrderId.trim() ||
    !value.approvedBy.trim() ||
    !Number.isFinite(receivedAt) ||
    receivedAt > Date.now() ||
    !value.inspection
  ) {
    return false;
  }
  return (
    value.inspection.printPlacementPass === true &&
    value.inspection.colorPass === true &&
    value.inspection.materialPass === true &&
    value.inspection.damageFree === true
  );
}
