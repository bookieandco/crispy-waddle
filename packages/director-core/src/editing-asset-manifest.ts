import type { GeneratedAssetRecord } from './generated-asset-resolver';

export type EditingAssetApproval = 'draft' | 'ready' | 'approved' | 'rejected';

export type EditingAssetManifestEntry = {
  assetId: string;
  projectId: string;
  generationJobId: string;
  kind: GeneratedAssetRecord['mediaType'];
  uri: string;
  mimeType?: string;
  status: EditingAssetApproval;
  usable: boolean;
  operationId?: string;
  sourceId?: string;
  startSeconds?: number;
  endSeconds?: number;
  metadata?: Record<string, unknown>;
};

/**
 * Projects a completed generated asset into the governed editing surface.
 * Assets are never considered usable merely because generation completed;
 * the editing manifest requires explicit approval.
 */
export function toEditingAssetManifestEntry(
  asset: GeneratedAssetRecord,
  approval: EditingAssetApproval = 'ready',
): EditingAssetManifestEntry {
  const metadata = asset.metadata ?? {};
  const operationId = typeof metadata.operationId === 'string' ? metadata.operationId : undefined;
  const sourceId = typeof metadata.sourceId === 'string' ? metadata.sourceId : undefined;
  const startSeconds = typeof metadata.startSeconds === 'number' ? metadata.startSeconds : undefined;
  const endSeconds = typeof metadata.endSeconds === 'number' ? metadata.endSeconds : undefined;

  return {
    assetId: asset.id,
    projectId: asset.projectId,
    generationJobId: asset.generationJobId,
    kind: asset.mediaType,
    uri: asset.uri,
    mimeType: asset.mimeType,
    status: approval,
    usable: approval === 'approved',
    operationId,
    sourceId,
    startSeconds,
    endSeconds,
    metadata,
  };
}

export function approvedEditingAssets(
  assets: GeneratedAssetRecord[],
): EditingAssetManifestEntry[] {
  return assets.map((asset) => toEditingAssetManifestEntry(asset, 'approved'));
}
