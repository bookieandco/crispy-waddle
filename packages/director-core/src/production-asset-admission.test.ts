import { describe, expect, it } from 'vitest';
import { directorProductionAssetBlockers, isDirectorProductionAsset } from './production-asset-admission';

describe('Director production asset admission — demo isolation', () => {
  it('permits a named real provider without demo metadata (not a quality certification)', () => {
    expect(isDirectorProductionAsset({ providerId: 'comfyui', metadata: { sourceId: 'shot-1' } })).toBe(true);
  });

  it.each(['director-certification-smoke', 'fixture', 'synthetic', 'mock', 'test', 'DIRECTOR-CERTIFICATION-future'])(
    'rejects non-production provider %s even after owner approval',
    providerId => {
      expect(directorProductionAssetBlockers({ providerId, metadata: {} }))
        .toContain('DIRECTOR_PRODUCTION_ASSET_NONPRODUCTION_PROVIDER');
    },
  );

  it.each([
    { liveCertification: true },
    { qualityClaim: false },
    { productionProvider: false },
    { renderer: 'mp4-timing-smoke' },
    { isDemo: true },
    { fixture: true },
  ])('rejects demo lineage even if provider claims to be real', metadata => {
    expect(directorProductionAssetBlockers({ provider_id: 'real-provider', metadata }))
      .toContain('DIRECTOR_PRODUCTION_ASSET_DEMO_METADATA');
  });

  it('fails closed for missing provider identifiers and ignores client approval labels', () => {
    expect(directorProductionAssetBlockers({ metadata: { approvalPolicy: 'standard', approved: true } }))
      .toContain('DIRECTOR_PRODUCTION_ASSET_PROVIDER_REQUIRED');
  });
});
