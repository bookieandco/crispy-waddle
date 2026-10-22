import { describe, expect, it } from 'vitest';
import {
  PUPSON_MATERIAL_PROFILES,
  PUPSON_STUDIO_STANDARD,
  assessUniformAssetPlan,
  type PupsonFactoryAssetPlan,
} from '../lib/product3d/asset-standard';
import { PUPSON_3D_GENERATORS } from '../lib/product3d/candidate-intake';

const hoodie: PupsonFactoryAssetPlan = {
  candidateId: 'hoodie-test-candidate',
  productId: 'hoodie',
  generator: 'aiuniai-unique3d',
  materialClass: 'textile',
  vendorDimensionsMm: [500, 700, 120],
  rawBoundsUnits: [5, 7, 1.2],
  vendorMeasurementEvidence: 'synthetic 500x700x120 mm fixture only, not a manufacturer measurement',
  verifiedReferenceViews: ['front', 'side', 'back'],
  orientationConfirmed: true,
  inputKind: 'synthetic',
  checkpointAndDependencyRightsReviewed: true,
  assetCommercialRightsReviewed: true,
  executionSeparatelyAuthorized: true,
  communityLicenseTerritoryAndTermsReviewed: false,
};
describe('PupsonStuff uniform blank-product 3D standard', () => {
  it('normalizes a candidate with one scale factor without automatic store promotion', () => {
    const answer = assessUniformAssetPlan(hoodie);
    expect(answer.status).toBe('quarantine-normalization-candidate');
    expect(answer.uniformScale).toBeCloseTo(0.1);
    expect(answer.normalizedBoundsMeters).not.toBeNull();
    for (const [value, target] of (answer.normalizedBoundsMeters ?? []).map(
      (value, index) => [value, [0.5, 0.7, 0.12][index]] as const,
    )) {
      expect(value).toBeCloseTo(target, 9);
    }
    expect(answer.storefrontApproved).toBe(false);
    expect(answer.requiresPhysicalAndVisualReview).toBe(true);
    expect(answer.studioStandard.personalizedArtworkBakedIntoMesh).toBe(false);
  });
  it('refuses to squash a lumpy/flat AI garment into production dimensions', () => {
    const out = assessUniformAssetPlan({ ...hoodie, rawBoundsUnits: [5, 7, 0.2] });
    expect(out.reasons).toContain('NONUNIFORM_PROPORTIONS_REFUSE_DISTORTION');
    expect(out.status).toBe('blocked');
  });
  it('refuses unknown or unmeasured Printify products and invalid numeric bounds', () => {
    const out = assessUniformAssetPlan({
      ...hoodie, vendorDimensionsMm: [500, NaN, 120],
      vendorMeasurementEvidence: 'unknown',
    });
    expect(out.reasons).toContain('MEASUREMENTS_INVALID');
    expect(out.reasons).toContain('SKU_MEASUREMENT_EVIDENCE_MISSING');
    expect(out.uniformScale).toBe(null);
  });
  it('requires real vendor reference views and confirmed front direction', () => {
    const out = assessUniformAssetPlan({
      ...hoodie, verifiedReferenceViews: ['front'], orientationConfirmed: false,
    });
    expect(out.reasons).toContain('THREE_PHYSICAL_REFERENCE_VIEWS_REQUIRED');
    expect(out.reasons).toContain('FRONT_AND_UP_ORIENTATION_UNCONFIRMED');
  });
  it('blocks customer media and missing output/checkpoint/execution rights', () => {
    const out = assessUniformAssetPlan({
      ...hoodie, inputKind: 'customer-media',
      executionSeparatelyAuthorized: false,
      checkpointAndDependencyRightsReviewed: false,
      assetCommercialRightsReviewed: false,
    });
    expect(out.reasons).toContain('CUSTOMER_MEDIA_NOT_AUTHORIZED_FOR_ASSET_FACTORY');
    expect(out.reasons).toContain('MODEL_AND_OUTPUT_RIGHTS_REVIEW_REQUIRED');
    expect(out.reasons).toContain('EXECUTION_APPROVAL_REQUIRED');
  });
  it('makes Hunyuan community license clearance a separate territory decision', () => {
    const out = assessUniformAssetPlan({ ...hoodie, generator: 'tencent-hunyuan3d-2' });
    expect(out.reasons).toContain('HUNYUAN_COMMUNITY_LICENSE_TERRITORY_REVIEW_REQUIRED');
    expect(assessUniformAssetPlan({
      ...hoodie, generator: 'tencent-hunyuan3d-2',
      communityLicenseTerritoryAndTermsReviewed: true,
    }).status).toBe('quarantine-normalization-candidate');
  });
  it('recognizes generator sources and distinct physical material profiles', () => {
    expect(PUPSON_3D_GENERATORS['tencent-hunyuan3d-2'].reference).toContain('Hunyuan3D-2');
    expect(PUPSON_3D_GENERATORS['aiuniai-unique3d'].reference).toContain('Unique3D');
    expect(PUPSON_3D_GENERATORS['ashawkey-stable-dreamfusion'].reference).toContain('stable-dreamfusion');
    expect(PUPSON_MATERIAL_PROFILES.textile.roughness).toBeGreaterThan(
      PUPSON_MATERIAL_PROFILES.ceramic.roughness);
    expect(PUPSON_STUDIO_STANDARD.previewAnglesDegrees).toEqual([0, 90, 180, 270]);
  });
});
