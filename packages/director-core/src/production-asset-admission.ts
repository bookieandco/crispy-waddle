/**
 * Production admission is separate from certification/demo playback.
 * This is a shared server-side denylist: approval, timeline, final QC and
 * Social must never promote a synthetic or qualityClaim:false asset.
 * The provider identity and persisted metadata are read from storage,
 * never from a client-submitted display manifest.
 */
export type DirectorProductionAssetOrigin = Readonly<{
  providerId?: unknown;
  provider_id?: unknown;
  metadata?: unknown;
}>;

const NON_PRODUCTION_PROVIDER_IDS = new Set([
  'director-certification-smoke',
  'fixture',
  'synthetic',
  'mock',
  'test',
]);

export function directorProductionAssetBlockers(asset: DirectorProductionAssetOrigin): string[] {
  const value = asset.providerId ?? asset.provider_id;
  const provider = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const metadata = asset.metadata && typeof asset.metadata === 'object' && !Array.isArray(asset.metadata)
    ? asset.metadata as Record<string, unknown> : {};
  const reasons: string[] = [];
  if (!provider) reasons.push('DIRECTOR_PRODUCTION_ASSET_PROVIDER_REQUIRED');
  else if (NON_PRODUCTION_PROVIDER_IDS.has(provider) || provider.startsWith('director-certification-')) {
    reasons.push('DIRECTOR_PRODUCTION_ASSET_NONPRODUCTION_PROVIDER');
  }
  if (metadata.liveCertification === true || metadata.certification === true ||
      metadata.isDemo === true || metadata.demo === true || metadata.fixture === true ||
      metadata.qualityClaim === false || metadata.productionProvider === false ||
      metadata.renderer === 'mp4-timing-smoke') {
    reasons.push('DIRECTOR_PRODUCTION_ASSET_DEMO_METADATA');
  }
  return reasons;
}

export function isDirectorProductionAsset(asset: DirectorProductionAssetOrigin): boolean {
  return directorProductionAssetBlockers(asset).length === 0;
}
