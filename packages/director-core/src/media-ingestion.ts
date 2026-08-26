export type MediaAssetKind = 'video' | 'audio' | 'image' | 'unknown';

export type MediaAssetStatus = 'imported' | 'probing' | 'ready' | 'failed';

export type MediaAsset = {
  id: string;
  projectId: string;
  sourcePath: string;
  kind: MediaAssetKind;
  status: MediaAssetStatus;
  originalFileName: string;
  mimeType?: string;
  durationSeconds?: number;
  sizeBytes?: number;
  probe?: Record<string, unknown>;
  proxyPath?: string;
  thumbnailPath?: string;
  waveformPath?: string;
  transcriptId?: string;
};

export type MediaImportRequest = {
  projectId: string;
  sourcePath: string;
  originalFileName: string;
  mimeType?: string;
  sizeBytes?: number;
};

export interface MediaAssetStore {
  save(asset: MediaAsset): Promise<void>;
  get(assetId: string): Promise<MediaAsset | null>;
  list(projectId: string): Promise<MediaAsset[]>;
}

export function createImportedMediaAsset(request: MediaImportRequest, id: string): MediaAsset {
  return {
    id,
    projectId: request.projectId,
    sourcePath: request.sourcePath,
    originalFileName: request.originalFileName,
    mimeType: request.mimeType,
    sizeBytes: request.sizeBytes,
    kind: inferMediaAssetKind(request.mimeType, request.originalFileName),
    status: 'imported',
  };
}

function inferMediaAssetKind(mimeType?: string, fileName = ''): MediaAssetKind {
  if (mimeType?.startsWith('video/')) return 'video';
  if (mimeType?.startsWith('audio/')) return 'audio';
  if (mimeType?.startsWith('image/')) return 'image';
  const extension = fileName.toLowerCase().split('.').pop();
  if (['mov', 'mp4', 'm4v', 'webm', 'mkv', 'avi'].includes(extension ?? '')) return 'video';
  if (['wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg'].includes(extension ?? '')) return 'audio';
  if (['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(extension ?? '')) return 'image';
  return 'unknown';
}
