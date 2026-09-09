import type { CreativeGate, ProductionRun } from '../../shotlist-core/src/production.js';
import type { GeneratedAssetRecord } from './generation-assets.js';
import type { CreativeStage } from './creative-stage-graph.js';
import type { MediaQualityEvidence } from './media-quality-evidence.js';

export interface DirectorMediaReviewGateInput {
  run: ProductionRun;
  gate: CreativeGate;
  generationStage: CreativeStage;
  reviewStage: CreativeStage;
  asset: GeneratedAssetRecord;
  evidence: MediaQualityEvidence[];
}

export interface DirectorMediaReviewGateDecision {
  allowed: boolean;
  reason: string;
}

/** The post-generation boundary: evidence informs review but never substitutes for explicit creative approval. */
export function evaluateDirectorMediaReviewGate(input: DirectorMediaReviewGateInput): DirectorMediaReviewGateDecision {
  const { run, gate, generationStage, reviewStage, asset, evidence } = input;

  if (run.status !== 'review' && run.status !== 'executing') {
    return { allowed: false, reason: `Production run is not reviewable: ${run.status}.` };
  }
  if (gate.kind !== 'rough_cut' || gate.decision !== 'approved') {
    return { allowed: false, reason: 'Explicit approved review Creative Gate is required.' };
  }
  if (generationStage.status !== 'review' && generationStage.status !== 'approved') {
    return { allowed: false, reason: `Generation stage is not reviewable: ${generationStage.status}.` };
  }
  if (reviewStage.status !== 'review' && reviewStage.status !== 'approved') {
    return { allowed: false, reason: `Review stage is not reviewable: ${reviewStage.status}.` };
  }
  if (asset.projectId !== run.projectId) {
    return { allowed: false, reason: 'Generated asset does not belong to the production project.' };
  }

  const assetEvidence = evidence.filter((item) => item.artifactId === asset.id);
  if (assetEvidence.length === 0) {
    return { allowed: false, reason: 'Generated asset has no matching media quality evidence.' };
  }
  if (assetEvidence.some((item) => item.status === 'fail')) {
    return { allowed: false, reason: 'Media quality evidence contains a failure; review cannot approve the asset.' };
  }
  if (asset.kind !== 'image' && asset.kind !== 'video') {
    return { allowed: false, reason: `Media quality evidence is unsupported for generated asset kind: ${asset.kind}.` };
  }
  if (assetEvidence.some((item) => item.kind !== asset.kind)) {
    return { allowed: false, reason: 'Media quality evidence kind does not match the generated asset.' };
  }

  return { allowed: true, reason: 'Generated asset has matching quality evidence and explicit approved creative review.' };
}
