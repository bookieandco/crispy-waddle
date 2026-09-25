import type { GeneratedAssetRecord } from './generated-asset-resolver.js';

export type CapturedMediaOrigin = 'captured' | 'uploaded' | 'imported';
export type CreativeWorkspaceMediaType = GeneratedAssetRecord['mediaType'];

export interface CapturedProjectMediaRecord {
  id: string;
  projectId: string;
  mediaType: CreativeWorkspaceMediaType;
  uri: string;
  mimeType?: string;
  sha256?: string;
  createdAt: string;
  origin: CapturedMediaOrigin;
  provenanceRefs: readonly string[];
  metadata?: Readonly<Record<string, unknown>>;
}

export interface CreativeWorkspaceAsset {
  id: string;
  projectId: string;
  origin: 'generated' | CapturedMediaOrigin;
  mediaType: CreativeWorkspaceMediaType;
  uri: string;
  mimeType?: string;
  sha256?: string;
  createdAt: string;
  generationJobId?: string;
  providerId?: string;
  modelId?: string;
  prompt?: string;
  provenanceRefs: readonly string[];
  metadata?: Readonly<Record<string, unknown>>;
}

export interface CreativeWorkspaceLibrary {
  projectId: string;
  allAssets: readonly CreativeWorkspaceAsset[];
  generatedHistory: readonly CreativeWorkspaceAsset[];
  capturedMedia: readonly CreativeWorkspaceAsset[];
  mediaCounts: Readonly<Record<CreativeWorkspaceMediaType, number>>;
  authority: 'DIRECTOR_CREATIVE_WORKSPACE_LIBRARY';
}

/**
 * Builds a single read-only project media view without replacing the canonical
 * generated/captured asset stores. Generated history and captured media keep
 * their provenance and can coexist in one editor/media panel.
 */
export function buildCreativeWorkspaceLibrary(input: {
  projectId: string;
  generatedAssets: readonly GeneratedAssetRecord[];
  capturedMedia: readonly CapturedProjectMediaRecord[];
}): CreativeWorkspaceLibrary {
  if (!input.projectId.trim()) throw new Error('DIRECTOR_WORKSPACE_PROJECT_REQUIRED');

  const generated=input.generatedAssets.map(asset=>generatedToWorkspace(input.projectId,asset));
  const captured=input.capturedMedia.map(asset=>capturedToWorkspace(input.projectId,asset));

  const ids=new Set<string>();
  for(const asset of [...generated,...captured]){
    if(ids.has(asset.id)) throw new Error(`DIRECTOR_WORKSPACE_ASSET_ID_CONFLICT:${asset.id}`);
    ids.add(asset.id);
  }

  const all=[...generated,...captured].sort((a,b)=>
    Date.parse(b.createdAt)-Date.parse(a.createdAt) || a.id.localeCompare(b.id)
  );
  const counts:Record<CreativeWorkspaceMediaType,number>={
    image:0,video:0,audio:0,'3d':0,motion:0,subtitle:0,unknown:0,
  };
  for(const asset of all) counts[asset.mediaType]+=1;

  return Object.freeze({
    projectId:input.projectId,
    allAssets:Object.freeze(all),
    generatedHistory:Object.freeze(generated.sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.id.localeCompare(b.id))),
    capturedMedia:Object.freeze(captured.sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.id.localeCompare(b.id))),
    mediaCounts:Object.freeze(counts),
    authority:'DIRECTOR_CREATIVE_WORKSPACE_LIBRARY',
  });
}

function generatedToWorkspace(projectId:string,asset:GeneratedAssetRecord):CreativeWorkspaceAsset{
  if(asset.projectId!==projectId) throw new Error(`DIRECTOR_WORKSPACE_GENERATED_PROJECT_MISMATCH:${asset.id}`);
  validateCommon(asset.id,asset.uri,asset.createdAt);
  if(!asset.generationJobId.trim()||!asset.providerId.trim()) {
    throw new Error(`DIRECTOR_WORKSPACE_GENERATED_LINEAGE_REQUIRED:${asset.id}`);
  }
  const provenanceRefs=asset.provenance
    ? [
        `generation-job:${asset.generationJobId}`,
        `provider:${asset.providerId}`,
        `generation-stage:${asset.provenance.generationStageId}:v${asset.provenance.generationStageVersion}`,
        `storyboard-version:${asset.provenance.storyboardVersion}`,
        ...asset.provenance.storyboardBoardIds.map(id=>`storyboard-board:${id}`),
      ]
    : [`generation-job:${asset.generationJobId}`,`provider:${asset.providerId}`];
  return Object.freeze({
    id:asset.id,
    projectId:asset.projectId,
    origin:'generated',
    mediaType:asset.mediaType,
    uri:asset.uri,
    mimeType:asset.mimeType,
    sha256:asset.sha256,
    createdAt:asset.createdAt,
    generationJobId:asset.generationJobId,
    providerId:asset.providerId,
    modelId:asset.modelId,
    prompt:asset.prompt,
    provenanceRefs:Object.freeze(provenanceRefs),
    metadata:asset.metadata ? Object.freeze({...asset.metadata}) : undefined,
  });
}

function capturedToWorkspace(projectId:string,asset:CapturedProjectMediaRecord):CreativeWorkspaceAsset{
  if(asset.projectId!==projectId) throw new Error(`DIRECTOR_WORKSPACE_CAPTURED_PROJECT_MISMATCH:${asset.id}`);
  validateCommon(asset.id,asset.uri,asset.createdAt);
  if(!asset.provenanceRefs.length) throw new Error(`DIRECTOR_WORKSPACE_CAPTURED_PROVENANCE_REQUIRED:${asset.id}`);
  return Object.freeze({
    id:asset.id,
    projectId:asset.projectId,
    origin:asset.origin,
    mediaType:asset.mediaType,
    uri:asset.uri,
    mimeType:asset.mimeType,
    sha256:asset.sha256,
    createdAt:asset.createdAt,
    provenanceRefs:Object.freeze([...asset.provenanceRefs]),
    metadata:asset.metadata ? Object.freeze({...asset.metadata}) : undefined,
  });
}

function validateCommon(id:string,uri:string,createdAt:string):void{
  if(!id.trim()||!uri.trim()) throw new Error(`DIRECTOR_WORKSPACE_ASSET_IDENTITY_REQUIRED:${id||'unknown'}`);
  if(!createdAt.trim()||!Number.isFinite(Date.parse(createdAt))) {
    throw new Error(`DIRECTOR_WORKSPACE_ASSET_TIME_INVALID:${id}`);
  }
}
