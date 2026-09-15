import { createHash } from 'node:crypto';
import { canonicalSpatialEvidenceInput, type SpatialEvidence } from './evidence.js';

/** Content-address the evidence envelope without including its hash field. */
export function spatialEvidenceHash(evidence: Omit<SpatialEvidence, 'integrity'>): string {
  return createHash('sha256')
    .update(`jhadina-spatial-evidence:v1:${canonicalSpatialEvidenceInput(evidence)}`, 'utf8')
    .digest('hex');
}
