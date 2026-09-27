export type ProductionAssetKind =
  | 'character' | 'wearable' | 'accessory' | 'prop' | 'product'
  | 'furniture' | 'vehicle' | 'environment' | 'material' | 'camera' | 'other';

export type ProductionReferenceRole =
  | 'face' | 'body' | 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'
  | 'detail' | 'in-use' | 'geometry' | 'material' | 'logo' | 'motion' | 'audio' | 'other';

export interface ProductionAssetReference {
  id: string;
  assetId: string;
  sha256: string;
  role: ProductionReferenceRole;
  rightsRef: string;
  evidenceIds: readonly string[];
}

export interface AssetInteractionAnchor {
  id: string;
  name: string;
  affordances: readonly string[];
  localPosition?: readonly [number, number, number];
  localRotationDegrees?: readonly [number, number, number];
}

export interface ProductionAssetSpatialProfile {
  dimensionsMeters?: Readonly<{ width: number; height: number; depth: number }>;
  massKg?: number;
  collisionAssetRef?: string;
  renderGeometryAssetRef?: string;
  supportSurfaceIds?: readonly string[];
  interactionAnchors?: readonly AssetInteractionAnchor[];
}

export interface ProductionDerivedPayload {
  id: string;
  kind: 'lora' | 'embedding' | 'mesh' | 'gaussian-splat' | 'material-pack' | 'rig' | 'motion-profile' | 'voice-profile' | 'other';
  engineId: string;
  engineVersion: string;
  artifactRef: string;
  sha256: string;
  sourceFingerprint: string;
  createdAt: string;
  evidenceIds: readonly string[];
}

export interface ProductionAssetRights {
  ownership: 'owned' | 'licensed' | 'authorized' | 'research-only' | 'unknown';
  commercialUse: 'allowed' | 'forbidden' | 'agreement-dependent' | 'unknown';
  consentRef?: string;
  licenseRef?: string;
  expiresAt?: string;
  territory?: readonly string[];
  disclosureRefs?: readonly string[];
}

export interface ProductionAssetPackage {
  id: string;
  version: number;
  kind: ProductionAssetKind;
  displayName: string;
  canonicalReferences: readonly ProductionAssetReference[];
  sourceFingerprint: string;
  descriptiveTags: readonly string[];
  immutableTraits: readonly string[];
  changeableTraits: readonly string[];
  spatial?: ProductionAssetSpatialProfile;
  derivedPayloads: readonly ProductionDerivedPayload[];
  rights: ProductionAssetRights;
  commercialProductRef?: string;
  createdAt: string;
  updatedAt: string;
  authority: 'DIRECTOR_PRODUCTION_ASSET_PACKAGE';
}

export function productionAssetSourceFingerprint(references: readonly ProductionAssetReference[]): string {
  return references.map(ref => `${ref.id}:${ref.role}:${ref.sha256.toLowerCase()}`).sort().join('|');
}

export function buildProductionAssetPackage(
  input: Omit<ProductionAssetPackage, 'sourceFingerprint' | 'authority'>,
): ProductionAssetPackage {
  const pkg: ProductionAssetPackage = {
    ...input,
    canonicalReferences: Object.freeze([...input.canonicalReferences]),
    descriptiveTags: Object.freeze([...input.descriptiveTags]),
    immutableTraits: Object.freeze([...input.immutableTraits]),
    changeableTraits: Object.freeze([...input.changeableTraits]),
    derivedPayloads: Object.freeze([...input.derivedPayloads]),
    sourceFingerprint: productionAssetSourceFingerprint(input.canonicalReferences),
    authority: 'DIRECTOR_PRODUCTION_ASSET_PACKAGE',
  };
  const reasons = validateProductionAssetPackage(pkg);
  if (reasons.length) throw new Error(`DIRECTOR_ASSET_PACKAGE_INVALID: ${reasons.join(', ')}`);
  return Object.freeze(pkg);
}

export function validateProductionAssetPackage(pkg: ProductionAssetPackage): readonly string[] {
  const reasons: string[] = [];
  if (!pkg.id.trim() || !pkg.displayName.trim()) reasons.push('DIRECTOR_ASSET_PACKAGE_IDENTITY_REQUIRED');
  if (!Number.isInteger(pkg.version) || pkg.version < 1) reasons.push('DIRECTOR_ASSET_PACKAGE_VERSION_INVALID');
  if (!pkg.canonicalReferences.length) reasons.push('DIRECTOR_ASSET_PACKAGE_REFERENCE_REQUIRED');
  if (!pkg.descriptiveTags.length) reasons.push('DIRECTOR_ASSET_PACKAGE_TAGS_REQUIRED');
  if (pkg.rights.commercialUse === 'forbidden' && pkg.commercialProductRef) reasons.push('DIRECTOR_ASSET_PACKAGE_COMMERCIAL_CONFLICT');
  for (const ref of pkg.canonicalReferences) {
    if (!ref.id.trim() || !ref.assetId.trim() || !ref.rightsRef.trim() || !ref.evidenceIds.length) {
      reasons.push('DIRECTOR_ASSET_PACKAGE_REFERENCE_INVALID');
    }
    if (!/^[a-f0-9]{32,128}$/i.test(ref.sha256)) reasons.push('DIRECTOR_ASSET_PACKAGE_REFERENCE_HASH_INVALID');
  }
  if (pkg.sourceFingerprint !== productionAssetSourceFingerprint(pkg.canonicalReferences)) {
    reasons.push('DIRECTOR_ASSET_PACKAGE_SOURCE_FINGERPRINT_MISMATCH');
  }
  if (!Number.isFinite(Date.parse(pkg.createdAt)) || !Number.isFinite(Date.parse(pkg.updatedAt))) {
    reasons.push('DIRECTOR_ASSET_PACKAGE_TIME_INVALID');
  }
  for (const payload of pkg.derivedPayloads) {
    if (!payload.id.trim() || !payload.engineId.trim() || !payload.engineVersion.trim() || !payload.artifactRef.trim() || !payload.evidenceIds.length) {
      reasons.push('DIRECTOR_ASSET_PACKAGE_PAYLOAD_INVALID');
    }
    if (payload.sourceFingerprint !== pkg.sourceFingerprint) reasons.push(`DIRECTOR_ASSET_PACKAGE_PAYLOAD_STALE:${payload.id}`);
  }
  return Object.freeze([...new Set(reasons)]);
}

export function currentProductionPayloads(pkg: ProductionAssetPackage): readonly ProductionDerivedPayload[] {
  return Object.freeze(pkg.derivedPayloads.filter(payload => payload.sourceFingerprint === pkg.sourceFingerprint));
}

export type WardrobeItemState = 'available' | 'wearing' | 'laundry' | 'damaged' | 'loaned' | 'campaign-reserved' | 'archived';
export type WardrobeSlot = 'top' | 'bottom' | 'full-body' | 'outerwear' | 'shoes' | 'bag' | 'jewellery' | 'hat' | 'eyewear' | 'watch' | 'other';

export interface FashionMetadata {
  category: WardrobeSlot;
  subcategory: string;
  colors: readonly string[];
  styleTags: readonly string[];
  materials: readonly string[];
  fitTags: readonly string[];
  brand?: string;
  fashionEmbeddingRef?: string;
}

export interface WardrobeItem {
  id: string;
  characterId: string;
  productionAssetPackageRef: string;
  metadata: FashionMetadata;
  state: WardrobeItemState;
  storageLocationRef?: string;
  wearCount: number;
  lastWornAt?: string;
  commercialProductRef?: string;
  evidenceIds: readonly string[];
}

export interface WardrobeCandidateScore {
  item: WardrobeItem;
  colorHarmony: number;
  silhouetteFit: number;
  characterStyleFit: number;
  sceneFit: number;
  continuityFit: number;
  commercialFit: number;
}

export interface WardrobeLookRequest {
  characterId: string;
  requiredSlots: readonly WardrobeSlot[];
  optionalSlots?: readonly WardrobeSlot[];
  requiredItemIds?: readonly string[];
  forbiddenItemIds?: readonly string[];
  allowCommercialPlacement: boolean;
}

export interface WardrobeLookPlan {
  characterId: string;
  selectedItemIds: readonly string[];
  commercialProductRefs: readonly string[];
  score: number;
  authority: 'DIRECTOR_WARDROBE_PLAN';
}

function wardrobeScore(candidate: WardrobeCandidateScore): number {
  return candidate.colorHarmony * 0.15
    + candidate.silhouetteFit * 0.2
    + candidate.characterStyleFit * 0.2
    + candidate.sceneFit * 0.2
    + candidate.continuityFit * 0.2
    + candidate.commercialFit * 0.05;
}

function wardrobeEligible(item: WardrobeItem): boolean {
  return item.state === 'available' || item.state === 'wearing' || item.state === 'campaign-reserved';
}

export function selectWardrobeLook(candidates: readonly WardrobeCandidateScore[], request: WardrobeLookRequest): WardrobeLookPlan {
  const forbidden = new Set(request.forbiddenItemIds ?? []);
  const required = new Set(request.requiredItemIds ?? []);
  for (const candidate of candidates) {
    for (const value of [candidate.colorHarmony, candidate.silhouetteFit, candidate.characterStyleFit, candidate.sceneFit, candidate.continuityFit, candidate.commercialFit]) {
      if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('DIRECTOR_WARDROBE_SCORE_INVALID');
    }
  }
  const selected: WardrobeCandidateScore[] = [];
  for (const id of required) {
    const found = candidates.find(candidate => candidate.item.id === id);
    if (!found || found.item.characterId !== request.characterId || !wardrobeEligible(found.item) || forbidden.has(id)) {
      throw new Error(`DIRECTOR_WARDROBE_REQUIRED_ITEM_UNAVAILABLE:${id}`);
    }
    selected.push(found);
  }
  const pick = (slot: WardrobeSlot, mandatory: boolean) => {
    if (selected.some(entry => entry.item.metadata.category === slot)) return;
    const best = candidates
      .filter(entry => entry.item.characterId === request.characterId && entry.item.metadata.category === slot && wardrobeEligible(entry.item) && !forbidden.has(entry.item.id))
      .sort((a, b) => wardrobeScore(b) - wardrobeScore(a))[0];
    if (best) selected.push(best);
    else if (mandatory) throw new Error(`DIRECTOR_WARDROBE_SLOT_MISSING:${slot}`);
  };
  for (const slot of request.requiredSlots) pick(slot, true);
  for (const slot of request.optionalSlots ?? []) pick(slot, false);
  const commercial = request.allowCommercialPlacement
    ? [...new Set(selected.map(entry => entry.item.commercialProductRef).filter((v): v is string => Boolean(v)))]
    : [];
  return Object.freeze({
    characterId: request.characterId,
    selectedItemIds: Object.freeze([...new Set(selected.map(entry => entry.item.id))]),
    commercialProductRefs: Object.freeze(commercial),
    score: selected.length ? selected.reduce((sum, entry) => sum + wardrobeScore(entry), 0) / selected.length : 0,
    authority: 'DIRECTOR_WARDROBE_PLAN',
  });
}

export interface GarmentLockObservation {
  itemId: string;
  identityScore: number;
  colorScore: number;
  silhouetteScore: number;
  materialScore: number;
  logoOrPrintScore?: number;
  frameConsistencyScore: number;
  evidenceIds: readonly string[];
}

export function evaluateGarmentLock(
  observation: GarmentLockObservation,
  policy: { minimumIdentity:number; minimumColor:number; minimumSilhouette:number; minimumMaterial:number; minimumLogoOrPrint?:number; minimumFrameConsistency:number },
): readonly string[] {
  const reasons: string[] = [];
  if (!observation.evidenceIds.length) reasons.push('DIRECTOR_GARMENT_LOCK_EVIDENCE_REQUIRED');
  const checks: Array<[number,number,string]> = [
    [observation.identityScore,policy.minimumIdentity,'DIRECTOR_GARMENT_IDENTITY_DRIFT'],
    [observation.colorScore,policy.minimumColor,'DIRECTOR_GARMENT_COLOR_DRIFT'],
    [observation.silhouetteScore,policy.minimumSilhouette,'DIRECTOR_GARMENT_SILHOUETTE_DRIFT'],
    [observation.materialScore,policy.minimumMaterial,'DIRECTOR_GARMENT_MATERIAL_DRIFT'],
    [observation.frameConsistencyScore,policy.minimumFrameConsistency,'DIRECTOR_GARMENT_TEMPORAL_DRIFT'],
  ];
  if (observation.logoOrPrintScore !== undefined && policy.minimumLogoOrPrint !== undefined) {
    checks.push([observation.logoOrPrintScore,policy.minimumLogoOrPrint,'DIRECTOR_GARMENT_LOGO_PRINT_DRIFT']);
  }
  for (const [value,minimum,code] of checks) {
    if (!Number.isFinite(value) || value < 0 || value > 1) reasons.push('DIRECTOR_GARMENT_LOCK_SCORE_INVALID');
    else if (value < minimum) reasons.push(code);
  }
  return Object.freeze([...new Set(reasons)]);
}

export type WorldKind = 'fictional' | 'simulated-real' | 'real-digital-twin' | 'live-physical';
export type WorldEntityKind = 'character' | 'asset' | 'location' | 'camera' | 'agent' | 'vehicle' | 'other';

export interface WorldEntity {
  id: string;
  kind: WorldEntityKind;
  label: string;
  productionAssetPackageRef?: string;
  affordances?: readonly string[];
  evidenceIds: readonly string[];
}

export type WorldRelationKind = 'at' | 'inside' | 'on' | 'wearing' | 'owns' | 'holding' | 'seated-on' | 'attached-to' | 'borrowed-by' | 'visible-from' | 'contains';

export interface WorldRelation {
  id: string;
  subjectId: string;
  kind: WorldRelationKind;
  objectId: string;
  validFrom: string;
  validTo?: string;
  evidenceIds: readonly string[];
}

export interface WorldStateGraph {
  id: string;
  projectId: string;
  kind: WorldKind;
  coordinateFrameRef?: string;
  entities: readonly WorldEntity[];
  relations: readonly WorldRelation[];
  version: number;
  authority: 'DIRECTOR_WORLD_STATE';
}

function activeWorldRelation(graph: WorldStateGraph, subjectId: string, kind: WorldRelationKind): WorldRelation | undefined {
  return [...graph.relations].filter(r => r.subjectId === subjectId && r.kind === kind && !r.validTo)
    .sort((a,b) => Date.parse(b.validFrom) - Date.parse(a.validFrom))[0];
}

function worldLocation(graph: WorldStateGraph, entityId: string): string | undefined {
  return activeWorldRelation(graph,entityId,'at')?.objectId ?? activeWorldRelation(graph,entityId,'inside')?.objectId;
}

export function preflightSpatialAction(
  graph: WorldStateGraph,
  action: { actorId:string; targetId:string; affordance:string; requireCoLocated?:boolean },
): { admissible:boolean; reasons:readonly string[]; authority:'DIRECTOR_SPATIAL_PREFLIGHT' } {
  const reasons: string[] = [];
  if ((graph.kind === 'real-digital-twin' || graph.kind === 'live-physical') && !graph.coordinateFrameRef?.trim()) {
    reasons.push('DIRECTOR_WORLD_COORDINATE_FRAME_REQUIRED');
  }
  const actor = graph.entities.find(entity => entity.id === action.actorId);
  const target = graph.entities.find(entity => entity.id === action.targetId);
  if (!actor) reasons.push('DIRECTOR_SPATIAL_ACTOR_NOT_FOUND');
  if (!target) reasons.push('DIRECTOR_SPATIAL_TARGET_NOT_FOUND');
  if (target && !(target.affordances ?? []).includes(action.affordance)) reasons.push(`DIRECTOR_SPATIAL_AFFORDANCE_UNSUPPORTED:${action.affordance}`);
  if (actor && target && action.requireCoLocated !== false) {
    const a = worldLocation(graph,actor.id);
    const b = worldLocation(graph,target.id);
    if (a && b && a !== b) reasons.push('DIRECTOR_SPATIAL_NOT_COLOCATED');
  }
  return Object.freeze({admissible:reasons.length===0,reasons:Object.freeze(reasons),authority:'DIRECTOR_SPATIAL_PREFLIGHT'});
}

export type AdapterKind = 'mind' | 'visual-identity' | 'video' | 'domain' | 'task' | 'object' | 'garment' | 'style';
export type AdapterMetric = 'identity' | 'quality' | 'editability' | 'behavioral-fidelity' | 'voice-similarity' | 'temporal-consistency' | 'product-fidelity' | 'overfit' | 'artifact-risk';

export interface AdapterCheckpoint {
  id:string;
  jobId:string;
  step:number;
  artifactRef:string;
  metrics:Readonly<Partial<Record<AdapterMetric,number>>>;
  evidenceIds:readonly string[];
}

export interface AdapterCertificationPolicy {
  minimums:Readonly<Partial<Record<AdapterMetric,number>>>;
  maximums:Readonly<Partial<Record<AdapterMetric,number>>>;
  weights:Readonly<Partial<Record<AdapterMetric,number>>>;
  requiredMetrics:readonly AdapterMetric[];
}

export function evaluateAdapterCheckpoint(checkpoint:AdapterCheckpoint,policy:AdapterCertificationPolicy) {
  const reasons:string[]=[];
  if(!checkpoint.id.trim()||!checkpoint.jobId.trim()||!checkpoint.artifactRef.trim()||!checkpoint.evidenceIds.length) reasons.push('DIRECTOR_ADAPTER_CHECKPOINT_INVALID');
  for(const metric of policy.requiredMetrics) if(checkpoint.metrics[metric]===undefined) reasons.push(`DIRECTOR_ADAPTER_METRIC_REQUIRED:${metric}`);
  let weighted=0,total=0;
  for(const [metric,value] of Object.entries(checkpoint.metrics) as Array<[AdapterMetric,number]>) {
    if(!Number.isFinite(value)||value<0||value>1){reasons.push(`DIRECTOR_ADAPTER_METRIC_INVALID:${metric}`);continue;}
    const min=policy.minimums[metric],max=policy.maximums[metric];
    if(min!==undefined&&value<min) reasons.push(`DIRECTOR_ADAPTER_METRIC_LOW:${metric}`);
    if(max!==undefined&&value>max) reasons.push(`DIRECTOR_ADAPTER_METRIC_HIGH:${metric}`);
    const weight=policy.weights[metric]??0;
    weighted+=(metric==='overfit'||metric==='artifact-risk'?1-value:value)*weight;
    total+=weight;
  }
  return Object.freeze({checkpointId:checkpoint.id,certified:reasons.length===0,score:total?weighted/total:0,reasons:Object.freeze([...new Set(reasons)])});
}

export function chooseAdapterCheckpoint(checkpoints:readonly AdapterCheckpoint[],policy:AdapterCertificationPolicy):AdapterCheckpoint|undefined {
  return [...checkpoints].map(checkpoint=>({checkpoint,decision:evaluateAdapterCheckpoint(checkpoint,policy)}))
    .filter(entry=>entry.decision.certified)
    .sort((a,b)=>b.decision.score-a.decision.score||a.checkpoint.step-b.checkpoint.step)[0]?.checkpoint;
}

export type ProductionCoherenceMetric =
  | 'story-causality' | 'shot-purpose' | 'character-identity' | 'voice-identity'
  | 'wardrobe-continuity' | 'product-fidelity' | 'spatial-continuity'
  | 'performance-naturalness' | 'lip-sync' | 'audio-continuity'
  | 'temporal-continuity' | 'visual-cleanliness' | 'rights-coverage';

export interface ProductionCoherenceObservation {
  id:string;
  projectId:string;
  segmentRef:string;
  startSeconds:number;
  endSeconds:number;
  metrics:Readonly<Partial<Record<ProductionCoherenceMetric,number>>>;
  evidenceByMetric:Readonly<Partial<Record<ProductionCoherenceMetric,readonly string[]>>>;
  explicitBlockers?:readonly string[];
}

export function evaluateProductionCoherence(
  observations:readonly ProductionCoherenceObservation[],
  policy:{minimums:Readonly<Partial<Record<ProductionCoherenceMetric,number>>>;requiredMetrics:readonly ProductionCoherenceMetric[];weights:Readonly<Partial<Record<ProductionCoherenceMetric,number>>>},
) {
  const reasons:string[]=[];
  const rerun=new Set<string>();
  let weighted=0,total=0;
  if(!observations.length) reasons.push('DIRECTOR_COHERENCE_OBSERVATION_REQUIRED');
  for(const observation of observations) {
    for(const blocker of observation.explicitBlockers??[]){if(blocker.trim()){reasons.push(`DIRECTOR_COHERENCE_BLOCKER:${blocker}`);rerun.add(observation.segmentRef);}}
    for(const metric of policy.requiredMetrics){
      const value=observation.metrics[metric], evidence=observation.evidenceByMetric[metric]??[];
      if(value===undefined||!Number.isFinite(value)||value<0||value>1){reasons.push(`DIRECTOR_COHERENCE_METRIC_INVALID:${metric}`);rerun.add(observation.segmentRef);continue;}
      if(!evidence.length){reasons.push(`DIRECTOR_COHERENCE_EVIDENCE_REQUIRED:${metric}`);rerun.add(observation.segmentRef);}
      const min=policy.minimums[metric];
      if(min!==undefined&&value<min){reasons.push(`DIRECTOR_COHERENCE_LOW:${metric}`);rerun.add(observation.segmentRef);}
      const weight=policy.weights[metric]??0;weighted+=value*weight;total+=weight;
    }
  }
  return Object.freeze({admissible:reasons.length===0,score:total?weighted/total:0,reasons:Object.freeze([...new Set(reasons)]),rerunScopes:Object.freeze([...rerun]),authority:'DIRECTOR_COHERENCE_QC' as const});
}

export type CreativeControlScope = 'project' | 'act' | 'scene' | 'shot' | 'character' | 'asset' | 'wardrobe' | 'track' | 'clip' | 'audio' | 'grade';
export interface CreativeDirective {
  id:string; projectId:string; scope:CreativeControlScope; scopeRef:string; key:string;
  mode:'pin'|'forbid'|'prefer'|'allow'; value?:unknown; createdBy:'user'|'jhadina'|'system';
  createdAt:string; evidenceIds:readonly string[];
}

export function resolveCreativeControl(
  directives:readonly CreativeDirective[],
  request:{projectId:string;scope:CreativeControlScope;scopeRef:string;key:string;proposedValue?:unknown},
) {
  const candidates=directives.filter(d=>d.projectId===request.projectId&&d.scope===request.scope&&d.scopeRef===request.scopeRef&&d.key===request.key);
  const user=[...candidates].reverse().find(d=>d.createdBy==='user');
  const winner=user??[...candidates].reverse()[0];
  if(!winner) return Object.freeze({allowed:true,reason:'no-directive',authority:'DIRECTOR_CREATIVE_CONTROL' as const});
  if(!winner.id.trim()||!winner.evidenceIds.length||!Number.isFinite(Date.parse(winner.createdAt))) throw new Error('DIRECTOR_CREATIVE_DIRECTIVE_INVALID');
  if(winner.mode==='forbid') return Object.freeze({allowed:false,winningDirectiveId:winner.id,reason:'forbidden-by-directive',authority:'DIRECTOR_CREATIVE_CONTROL' as const});
  if(winner.mode==='pin'){
    const same=JSON.stringify(winner.value)===JSON.stringify(request.proposedValue);
    return Object.freeze({allowed:same,winningDirectiveId:winner.id,reason:same?'matches-pinned-value':'conflicts-with-pinned-value',authority:'DIRECTOR_CREATIVE_CONTROL' as const});
  }
  return Object.freeze({allowed:true,winningDirectiveId:winner.id,reason:winner.mode,authority:'DIRECTOR_CREATIVE_CONTROL' as const});
}

export type TimelineInterchangeFormat='otio'|'fcpxml'|'aaf'|'edl'|'premiere-xml';
export type TimelineFeature='source-ranges'|'connected-clips'|'lanes'|'transforms'|'crop'|'keyframes'|'retime'|'reverse'|'effects'|'transitions'|'subtitles'|'audio-roles'|'generative-regions'|'take-metadata'|'asset-provenance';

export function planTimelineInterchange(
  profile:{format:TimelineInterchangeFormat;supportedFeatures:readonly TimelineFeature[];lossyFeatures:readonly TimelineFeature[];supportsRoundTrip:boolean},
  request:{projectId:string;timelineVersionId:string;requiredFeatures:readonly TimelineFeature[];allowLossy:boolean;evidenceIds:readonly string[]},
) {
  const reasons:string[]=[];
  if(!request.projectId.trim()||!request.timelineVersionId.trim()||!request.evidenceIds.length) reasons.push('DIRECTOR_INTERCHANGE_IDENTITY_OR_EVIDENCE_REQUIRED');
  const supported=new Set(profile.supportedFeatures),lossyAllowed=new Set(profile.lossyFeatures);
  const preserved:TimelineFeature[]=[],lossy:TimelineFeature[]=[];
  for(const feature of request.requiredFeatures){
    if(supported.has(feature)) preserved.push(feature);
    else {lossy.push(feature);if(!request.allowLossy||!lossyAllowed.has(feature)) reasons.push(`DIRECTOR_INTERCHANGE_UNSUPPORTED_FEATURE:${feature}`);}
  }
  return Object.freeze({admissible:reasons.length===0,format:profile.format,preservedFeatures:Object.freeze([...new Set(preserved)]),lossyFeatures:Object.freeze([...new Set(lossy)]),reasons:Object.freeze([...new Set(reasons)]),authority:'DIRECTOR_TIMELINE_INTERCHANGE' as const});
}
