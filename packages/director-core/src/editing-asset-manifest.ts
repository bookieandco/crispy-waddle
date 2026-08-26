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

/** Projects a generated asset into the governed editing surface. */
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

/**
 * Projects a repository result using an explicit approval set.
 * Generation completion alone never grants editing permission.
 */
export function approvedEditingAssets(
  assets: GeneratedAssetRecord[],
  approvedAssetIds: ReadonlySet<string>,
): EditingAssetManifestEntry[] {
  return assets.map((asset) =>
    toEditingAssetManifestEntry(asset, approvedAssetIds.has(asset.id) ? 'approved' : 'ready'),
  );
}
