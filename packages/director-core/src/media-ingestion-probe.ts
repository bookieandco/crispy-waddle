import type { MediaAsset } from './media-ingestion.js';

export type MediaProbeRunner = {
  probe(sourcePath: string): Promise<{
    format?: { duration?: number; size?: number; formatName?: string };
    streams?: Array<Record<string, unknown>>;
  }>;
};

export async function probeImportedMedia(
  asset: MediaAsset,
  runner: MediaProbeRunner,
): Promise<MediaAsset> {
  if (asset.status !== 'imported' && asset.status !== 'probing') {
    throw new Error(`Media asset is not probeable in status: ${asset.status}`);
  }

  const result = await runner.probe(asset.sourcePath);
  return {
    ...asset,
    status: 'ready',
    durationSeconds: result.format?.duration ?? asset.durationSeconds,
    sizeBytes: result.format?.size ?? asset.sizeBytes,
    probe: result,
  };
}
