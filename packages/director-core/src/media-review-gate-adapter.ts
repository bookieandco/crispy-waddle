import type { CreativeGate, ProductionRun } from '../../shotlist-core/src/production.js';
import type { GeneratedAssetRecord } from './generation-assets.js';
import type { CreativeStage } from './creative-stage-graph.js';
import type { CreativeProvenance } from './creative-provenance.js';
import type { MediaQualityEvidence } from './media-quality-evidence.js';
import { sameCreativeProvenance } from './creative-provenance.js';

export interface DirectorMediaReviewGateInput {
  run: ProductionRun;
  gate: CreativeGate;
  generationStage: CreativeStage;
  reviewStage: CreativeStage;
  asset: GeneratedAssetRecord;
  evidence: MediaQualityEvidence[];
  expectedProvenance: CreativeProvenance;
}

export interface DirectorMediaReviewGateDecision {
  allowed: boolean;
  reason: string;
}

/** The post-generation boundary: evidence informs review but never substitutes for explicit creative approval. */
export function evaluateDirectorMediaReviewGate(input: DirectorMediaReviewGateInput): DirectorMediaReviewGateDecision {
  const { run, gate, generationStage, reviewStage, asset, evidence, expectedProvenance } = input;

  if (run.status !== 'review' && run.status !== 'executing') {
    return { allowed: false, reason: `Production run is not reviewable: ${run.status}.` };
  }
  if (gate.runId !== run.id || gate.kind !== 'rough_cut' || gate.decision !== 'approved') {
    return { allowed: false, reason: 'Explicit approved review Creative Gate for this run is required.' };
  }
  if (generationStage.projectId !== run.projectId || generationStage.kind !== 'generation' || (generationStage.status !== 'review' && generationStage.status !== 'approved')) {
    return { allowed: false, reason: 'Generation stage is not reviewable for this production project.' };
  }
  if (reviewStage.projectId !== run.projectId || reviewStage.kind !== 'review' || (reviewStage.status !== 'review' && reviewStage.status !== 'approved')) {
    return { allowed: false, reason: 'Review stage is not reviewable for this production project.' };
  }
  if (asset.projectId !== run.projectId || asset.generationJobId !== expectedProvenance.generationJobId) {
    return { allowed: false, reason: 'Generated asset does not match the expected production lineage.' };
  }
  if (!asset.provenance || !sameCreativeProvenance(asset.provenance, expectedProvenance)) {
    return { allowed: false, reason: 'Generated asset provenance does not match the current creative lineage.' };
  }
  if (expectedProvenance.generationStageId !== generationStage.id || expectedProvenance.generationStageVersion !== generationStage.version) {
    return { allowed: false, reason: 'Expected generation provenance does not match the current generation stage version.' };
  }
  if (!reviewStage.inputArtifactIds.includes(asset.id)) {
    return { allowed: false, reason: 'Review stage does not reference the generated asset.' };
  }

  if (asset.kind !== 'image' && asset.kind !== 'video') {
    return { allowed: false, reason: `Media quality evidence is unsupported for generated asset kind: ${asset.kind}.` };
  }
  const assetEvidence = evidence.filter((item) => item.artifactId === asset.id);
  if (assetEvidence.length === 0) {
    return { allowed: false, reason: 'Generated asset has no matching media quality evidence.' };
  }
  if (assetEvidence.some((item) => item.kind !== asset.kind)) {
    return { allowed: false, reason: 'Media quality evidence kind does not match the generated asset.' };
  }
  if (assetEvidence.some((item) => !item.provenance || !sameCreativeProvenance(item.provenance, expectedProvenance))) {
    return { allowed: false, reason: 'Media quality evidence is not bound to the current creative lineage.' };
  }
  if (asset.sha256 && assetEvidence.some((item) => item.assetSha256 !== asset.sha256)) {
    return { allowed: false, reason: 'Media quality evidence does not match the generated asset checksum.' };
  }
  if (assetEvidence.some((item) => item.status === 'fail')) {
    return { allowed: false, reason: 'Media quality evidence contains a failure; review cannot approve the asset.' };
  }

  return { allowed: true, reason: 'Generated asset, evidence, stage version, and explicit creative review share the same lineage.' };
}
