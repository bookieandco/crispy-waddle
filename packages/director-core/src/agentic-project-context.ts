import type { CreativeWorkspaceLibrary } from './creative-workspace-media.js';
import type { GenerationReferenceManifest, GenerationReferenceRole } from './generation-reference-manifest.js';
import type { GenerationCostEstimate } from './generation-spend-gate.js';

export type AgenticProjectAssetRole =
  | 'style'
  | 'character'
  | 'location'
  | 'prop'
  | 'effect'
  | 'composition'
  | 'motion'
  | 'other';

export interface AgenticProjectAssetBinding {
  assetId: string;
  role: AgenticProjectAssetRole;
  semanticLabel: string;
  /** Stable human/agent-facing tag such as character.raven or location.interview-couch. */
  elementTag?: string;
  media: 'image' | 'video' | 'audio';
  global: boolean;
  evidenceIds: readonly string[];
}

export interface AgenticSceneDefinition {
  id: string;
  order: number;
  startSeconds: number;
  endSeconds: number;
  direction: string;
  requiredAssetIds: readonly string[];
  optionalAssetIds: readonly string[];
  excludedAssetIds: readonly string[];
  evidenceIds: readonly string[];
}

export interface AgenticProjectContext {
  id: string;
  projectId: string;
  scriptAssetId: string;
  assets: readonly AgenticProjectAssetBinding[];
  scenes: readonly AgenticSceneDefinition[];
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_AGENTIC_PROJECT_CONTEXT';
}

export interface AgenticSceneExecutionContext {
  id: string;
  projectId: string;
  contextId: string;
  sceneId: string;
  scriptAssetId: string;
  targetDurationSeconds: number;
  direction: string;
  boundAssetIds: readonly string[];
  generationReferences: GenerationReferenceManifest;
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_AGENTIC_SCENE_CONTEXT';
}

export type AgenticCostComponentKind =
  | 'media-generation'
  | 'reference-surcharge'
  | 'orchestration'
  | 'repair';

export interface AgenticSceneCostComponent {
  kind: AgenticCostComponentKind;
  estimate: GenerationCostEstimate;
  evidenceIds: readonly string[];
}

export interface AgenticSceneCostPlan {
  id: string;
  projectId: string;
  sceneId: string;
  components: readonly AgenticSceneCostComponent[];
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_AGENTIC_SCENE_COST';
}

export interface AgenticSceneCostSummary {
  totalEstimatedUsd: number;
  byKind: Readonly<Record<AgenticCostComponentKind, number>>;
  reasons: readonly string[];
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_AGENTIC_SCENE_COST_QC';
}

export interface DirectorCollaborationProfile {
  id: string;
  mode: 'technical-collaborator';
  responseStyle: 'concise' | 'balanced' | 'detailed';
  praisePolicy: 'evidence-only';
  optimizeForModelId?: string;
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_COLLABORATION_PROFILE';
}

export function validateAgenticProjectContext(context: AgenticProjectContext): readonly string[] {
  const reasons: string[] = [];
  if (!context.id.trim() || !context.projectId.trim() || !context.scriptAssetId.trim()) {
    reasons.push('DIRECTOR_AGENTIC_CONTEXT_IDENTITY_REQUIRED');
  }
  if (!context.assets.length) reasons.push('DIRECTOR_AGENTIC_CONTEXT_ASSETS_REQUIRED');
  if (!context.scenes.length) reasons.push('DIRECTOR_AGENTIC_CONTEXT_SCENES_REQUIRED');
  if (!context.evidenceIds.length) reasons.push('DIRECTOR_AGENTIC_CONTEXT_EVIDENCE_REQUIRED');

  const assetIds = new Set<string>();
  const elementTags = new Set<string>();
  for (const asset of context.assets) {
    if (!asset.assetId.trim() || assetIds.has(asset.assetId)) {
      reasons.push(`DIRECTOR_AGENTIC_ASSET_ID_INVALID:${asset.assetId || 'unknown'}`);
    }
    assetIds.add(asset.assetId);
    if (!asset.semanticLabel.trim()) reasons.push(`DIRECTOR_AGENTIC_ASSET_LABEL_REQUIRED:${asset.assetId}`);
    if (asset.elementTag !== undefined) {
      const tag=asset.elementTag.trim();
      if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(tag)) {
        reasons.push(`DIRECTOR_AGENTIC_ELEMENT_TAG_INVALID:${asset.assetId}`);
      } else if (elementTags.has(tag)) {
        reasons.push(`DIRECTOR_AGENTIC_ELEMENT_TAG_DUPLICATE:${tag}`);
      } else {
        elementTags.add(tag);
      }
    }
    if (!asset.evidenceIds.length) reasons.push(`DIRECTOR_AGENTIC_ASSET_EVIDENCE_REQUIRED:${asset.assetId}`);
  }

  const sceneIds = new Set<string>();
  let previousOrder = 0;
  for (const scene of [...context.scenes].sort((a,b)=>a.order-b.order)) {
    if (!scene.id.trim() || sceneIds.has(scene.id)) reasons.push(`DIRECTOR_AGENTIC_SCENE_ID_INVALID:${scene.id || 'unknown'}`);
    sceneIds.add(scene.id);
    if (!Number.isInteger(scene.order) || scene.order < 1 || scene.order <= previousOrder) {
      reasons.push(`DIRECTOR_AGENTIC_SCENE_ORDER_INVALID:${scene.id}`);
    }
    previousOrder = scene.order;
    if (
      !Number.isFinite(scene.startSeconds) ||
      !Number.isFinite(scene.endSeconds) ||
      scene.startSeconds < 0 ||
      scene.endSeconds <= scene.startSeconds
    ) reasons.push(`DIRECTOR_AGENTIC_SCENE_TIME_INVALID:${scene.id}`);
    if (!scene.direction.trim()) reasons.push(`DIRECTOR_AGENTIC_SCENE_DIRECTION_REQUIRED:${scene.id}`);
    if (!scene.evidenceIds.length) reasons.push(`DIRECTOR_AGENTIC_SCENE_EVIDENCE_REQUIRED:${scene.id}`);

    const lists = [scene.requiredAssetIds,scene.optionalAssetIds,scene.excludedAssetIds];
    for (const list of lists) {
      for (const assetId of list) {
        if (!assetIds.has(assetId)) reasons.push(`DIRECTOR_AGENTIC_SCENE_ASSET_UNKNOWN:${scene.id}:${assetId}`);
      }
    }
    const required = new Set(scene.requiredAssetIds);
    const optional = new Set(scene.optionalAssetIds);
    const excluded = new Set(scene.excludedAssetIds);
    if ([...required].some(id=>optional.has(id)||excluded.has(id)) || [...optional].some(id=>excluded.has(id))) {
      reasons.push(`DIRECTOR_AGENTIC_SCENE_ASSET_SCOPE_CONFLICT:${scene.id}`);
    }
  }

  return Object.freeze([...new Set(reasons)]);
}

export function resolveAgenticSceneContext(input: {
  id: string;
  context: AgenticProjectContext;
  library: CreativeWorkspaceLibrary;
  sceneId: string;
  supplementalAssetIds?: readonly string[];
  evidenceIds: readonly string[];
}): AgenticSceneExecutionContext {
  const reasons = [...validateAgenticProjectContext(input.context)];
  if (input.library.projectId !== input.context.projectId) reasons.push('DIRECTOR_AGENTIC_LIBRARY_PROJECT_MISMATCH');
  if (!input.id.trim() || !input.evidenceIds.length) reasons.push('DIRECTOR_AGENTIC_SCENE_REQUEST_IDENTITY_REQUIRED');

  const scene = input.context.scenes.find(candidate=>candidate.id===input.sceneId);
  if (!scene) reasons.push('DIRECTOR_AGENTIC_SCENE_NOT_FOUND');

  const libraryIds = new Set(input.library.allAssets.map(asset=>asset.id));
  const contextAssets = new Map(input.context.assets.map(asset=>[asset.assetId,asset]));
  for (const asset of input.context.assets) {
    if (!libraryIds.has(asset.assetId)) reasons.push(`DIRECTOR_AGENTIC_WORKSPACE_ASSET_MISSING:${asset.assetId}`);
  }
  if (!libraryIds.has(input.context.scriptAssetId)) reasons.push('DIRECTOR_AGENTIC_SCRIPT_ASSET_MISSING');

  if (scene) {
    const allowedSupplemental = new Set([...scene.requiredAssetIds,...scene.optionalAssetIds]);
    for (const assetId of input.supplementalAssetIds ?? []) {
      if (!allowedSupplemental.has(assetId)) reasons.push(`DIRECTOR_AGENTIC_SCENE_SUPPLEMENTAL_NOT_ALLOWED:${assetId}`);
    }
  }

  if (reasons.length || !scene) {
    throw new Error(`DIRECTOR_AGENTIC_SCENE_CONTEXT_INVALID: ${[...new Set(reasons)].join(', ')}`);
  }

  const boundIds = new Set<string>();
  for (const asset of input.context.assets) if (asset.global) boundIds.add(asset.assetId);
  for (const assetId of scene.requiredAssetIds) boundIds.add(assetId);
  for (const assetId of input.supplementalAssetIds ?? []) boundIds.add(assetId);
  for (const assetId of scene.excludedAssetIds) boundIds.delete(assetId);

  const references = [...boundIds]
    .map(assetId=>contextAssets.get(assetId))
    .filter((asset): asset is AgenticProjectAssetBinding=>Boolean(asset))
    .sort((a,b)=>referencePriority(a.role)-referencePriority(b.role)||a.assetId.localeCompare(b.assetId))
    .map((asset,index)=>Object.freeze({
      slot:index+1,
      assetId:asset.assetId,
      media:asset.media,
      role:referenceRole(asset.role),
      semanticLabel:asset.semanticLabel,
      promptToken:`PROJECT_REF_${index+1}`,
      required:true,
      evidenceIds:Object.freeze([...asset.evidenceIds,...scene.evidenceIds]),
    }));

  const manifest:GenerationReferenceManifest=Object.freeze({
    id:`${input.id}:references`,
    projectId:input.context.projectId,
    shotId:scene.id,
    references:Object.freeze(references),
    authority:'DIRECTOR_REFERENCE_MANIFEST',
  });

  return Object.freeze({
    id:input.id,
    projectId:input.context.projectId,
    contextId:input.context.id,
    sceneId:scene.id,
    scriptAssetId:input.context.scriptAssetId,
    targetDurationSeconds:scene.endSeconds-scene.startSeconds,
    direction:scene.direction,
    boundAssetIds:Object.freeze([...boundIds]),
    generationReferences:manifest,
    evidenceIds:Object.freeze([
      ...input.context.evidenceIds,
      ...scene.evidenceIds,
      ...input.evidenceIds,
      `script:${input.context.scriptAssetId}`,
      `scene-range:${scene.startSeconds}-${scene.endSeconds}`,
    ]),
    authority:'DIRECTOR_AGENTIC_SCENE_CONTEXT',
  });
}

export function summarizeAgenticSceneCost(plan: AgenticSceneCostPlan): AgenticSceneCostSummary {
  const reasons: string[] = [];
  if (!plan.id.trim() || !plan.projectId.trim() || !plan.sceneId.trim()) reasons.push('DIRECTOR_AGENTIC_COST_IDENTITY_REQUIRED');
  if (!plan.components.length) reasons.push('DIRECTOR_AGENTIC_COST_COMPONENTS_REQUIRED');
  if (!plan.evidenceIds.length) reasons.push('DIRECTOR_AGENTIC_COST_EVIDENCE_REQUIRED');

  const byKind: Record<AgenticCostComponentKind,number>={
    'media-generation':0,
    'reference-surcharge':0,
    orchestration:0,
    repair:0,
  };
  const evidenceIds=[...plan.evidenceIds];

  for (const component of plan.components) {
    const estimate=component.estimate;
    if (estimate.projectId!==plan.projectId) reasons.push(`DIRECTOR_AGENTIC_COST_PROJECT_MISMATCH:${estimate.id}`);
    if (!estimate.id.trim()||!estimate.provider.trim()||!estimate.modelId.trim()||!estimate.pricingSourceRef.trim()) {
      reasons.push(`DIRECTOR_AGENTIC_COST_ESTIMATE_IDENTITY_REQUIRED:${estimate.id||'unknown'}`);
    }
    if (
      !Number.isFinite(estimate.quantity)||estimate.quantity<=0||
      !Number.isFinite(estimate.unitPriceUsd)||estimate.unitPriceUsd<0||
      !Number.isFinite(estimate.estimatedCostUsd)||estimate.estimatedCostUsd<0
    ) reasons.push(`DIRECTOR_AGENTIC_COST_ESTIMATE_INVALID:${estimate.id}`);
    const recomputed=estimate.quantity*estimate.unitPriceUsd;
    if (Math.abs(recomputed-estimate.estimatedCostUsd)>0.01) reasons.push(`DIRECTOR_AGENTIC_COST_ESTIMATE_MISMATCH:${estimate.id}`);
    if (!component.evidenceIds.length) reasons.push(`DIRECTOR_AGENTIC_COST_COMPONENT_EVIDENCE_REQUIRED:${estimate.id}`);
    byKind[component.kind]+=estimate.estimatedCostUsd;
    evidenceIds.push(...component.evidenceIds);
  }

  const total=Object.values(byKind).reduce((sum,value)=>sum+value,0);
  return Object.freeze({
    totalEstimatedUsd:total,
    byKind:Object.freeze({...byKind}),
    reasons:Object.freeze([...new Set(reasons)]),
    evidenceIds:Object.freeze([...new Set(evidenceIds)]),
    authority:'DIRECTOR_AGENTIC_SCENE_COST_QC',
  });
}

export function validateDirectorCollaborationProfile(profile: DirectorCollaborationProfile): readonly string[] {
  const reasons: string[] = [];
  if (!profile.id.trim()) reasons.push('DIRECTOR_COLLABORATION_PROFILE_ID_REQUIRED');
  if (profile.mode!=='technical-collaborator') reasons.push('DIRECTOR_COLLABORATION_MODE_INVALID');
  if (profile.praisePolicy!=='evidence-only') reasons.push('DIRECTOR_COLLABORATION_PRAISE_POLICY_INVALID');
  if (!profile.evidenceIds.length) reasons.push('DIRECTOR_COLLABORATION_PROFILE_EVIDENCE_REQUIRED');
  return Object.freeze(reasons);
}

function referenceRole(role:AgenticProjectAssetRole):GenerationReferenceRole{
  if(role==='style') return 'style';
  if(role==='character') return 'character-identity';
  if(role==='location') return 'location';
  if(role==='composition') return 'composition';
  if(role==='motion') return 'motion';
  return 'custom';
}


function referencePriority(role:AgenticProjectAssetRole):number{
  const priorities:Record<AgenticProjectAssetRole,number>={
    style:1,character:2,location:3,prop:4,effect:5,composition:6,motion:7,other:8,
  };
  return priorities[role];
}
