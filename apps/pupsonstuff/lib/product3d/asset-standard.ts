/**
 * Canonical PupsonStuff blank-product asset standard.
 *
 * Source-only quality planning. The generator belongs to the existing
 * Director backend authority; this module neither invokes a generator nor
 * modifies an approved GLB, Printify variant, or customer image.
 */
import { PUPSON_3D_GENERATORS, type Pupson3DGenerator } from './candidate-intake';

export const PUPSON_STUDIO_STANDARD = Object.freeze({
  version: 'pupson-physical-product-v1',
  upAxis: '+Y',
  frontFacingCamera: '+Z',
  units: 'meters',
  pivot: 'bounding-box-center',
  renderer: 'studio-softbox-neutral-v1',
  backdrop: '#F7F4EF',
  previewAnglesDegrees: Object.freeze([0, 90, 180, 270]),
  maxModelBytes: 10 * 1024 * 1024,
  maxTriangles: 120_000,
  maxTextureEdgePx: 2048,
  maximumDimensionErrorRatio: 0.07,
  // This is a *blank* product model. Pet portraits remain separately
  // positioned and constrained by the existing Printify print master.
  personalizedArtworkBakedIntoMesh: false,
} as const);

export const PUPSON_MATERIAL_PROFILES = Object.freeze({
  textile: Object.freeze({ metallic: 0, roughness: 0.86, label: 'woven fabric' }),
  ceramic: Object.freeze({ metallic: 0, roughness: 0.24, label: 'glazed ceramic' }),
  canvas: Object.freeze({ metallic: 0, roughness: 0.92, label: 'matte canvas' }),
  metal: Object.freeze({ metallic: 0.72, roughness: 0.32, label: 'powder-coated metal' }),
} as const);
export type PupsonMaterialClass = keyof typeof PUPSON_MATERIAL_PROFILES;

export interface PupsonFactoryAssetPlan {
  candidateId: string;
  productId: string;
  generator: Pupson3DGenerator;
  materialClass: PupsonMaterialClass;
  /** Millimeters from the *real manufacturer SKU*, never a model guess. [W,H,D] */
  vendorDimensionsMm: readonly [number, number, number];
  /** Raw imported Blender geometry bounds [W,H,D] in Blender world units. */
  rawBoundsUnits: readonly [number, number, number];
  /** Source evidence, e.g. the Printify SKU/physical sample sheet reference. */
  vendorMeasurementEvidence: string;
  /** At least front + side + back real-product reference images for visual review. */
  verifiedReferenceViews: readonly ('front' | 'side' | 'back')[];
  /** Model orientation must be operator-verified, never guessed from bbox axes. */
  orientationConfirmed: boolean;
  inputKind: 'synthetic' | 'operator-owned-reference' | 'customer-media';
  /** Explicit post-review authorization, not inferred from having a GPU/key. */
  checkpointAndDependencyRightsReviewed: boolean;
  assetCommercialRightsReviewed: boolean;
  executionSeparatelyAuthorized: boolean;
  /** Hunyuan3D-2 output/use may be territorially restricted even if local. */
  communityLicenseTerritoryAndTermsReviewed: boolean;
}

export interface PupsonAssetStandardResult {
  status: 'blocked' | 'quarantine-normalization-candidate';
  storefrontApproved: false;
  requiresPhysicalAndVisualReview: true;
  reasons: readonly string[];
  uniformScale: number | null;
  normalizedBoundsMeters: readonly [number, number, number] | null;
  studioStandard: typeof PUPSON_STUDIO_STANDARD;
}

const validId = /^[a-z][a-z0-9-]{1,63}$/;
function positiveFinite(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}
function hasEvidence(s: string): boolean {
  return typeof s === 'string' && s.trim().length >= 8;
}

/**
 * The real-world *height* anchors a UNIFORM scale. Never resize width, height
 * and depth independently to force a synthetic mesh to fit SKU dimensions:
 * that makes mugs oval and garments unnaturally thin.
 */
export function assessUniformAssetPlan(p: PupsonFactoryAssetPlan): PupsonAssetStandardResult {
  const reasons: string[] = [];
  let scale: number | null = null;
  let bounds: readonly [number, number, number] | null = null;
  if (!validId.test(p.candidateId) || !validId.test(p.productId)) {
    reasons.push('IDENTITY_INVALID');
  }
  if (!Object.prototype.hasOwnProperty.call(PUPSON_3D_GENERATORS, p.generator)) {
    reasons.push('GENERATOR_UNRECOGNIZED');
  }
  if (!Object.prototype.hasOwnProperty.call(PUPSON_MATERIAL_PROFILES, p.materialClass)) {
    reasons.push('MATERIAL_CLASS_INVALID');
  }
  if (!hasEvidence(p.vendorMeasurementEvidence)) reasons.push('SKU_MEASUREMENT_EVIDENCE_MISSING');
  if (p.inputKind === 'customer-media') reasons.push('CUSTOMER_MEDIA_NOT_AUTHORIZED_FOR_ASSET_FACTORY');
  if (p.inputKind !== 'synthetic' && p.inputKind !== 'operator-owned-reference') {
    if (p.inputKind !== 'customer-media') reasons.push('INPUT_SOURCE_UNRECOGNIZED');
  }
  if (!p.checkpointAndDependencyRightsReviewed || !p.assetCommercialRightsReviewed) {
    reasons.push('MODEL_AND_OUTPUT_RIGHTS_REVIEW_REQUIRED');
  }
  if (!p.executionSeparatelyAuthorized) reasons.push('EXECUTION_APPROVAL_REQUIRED');
  if (p.generator === 'tencent-hunyuan3d-2' &&
      !p.communityLicenseTerritoryAndTermsReviewed) {
    reasons.push('HUNYUAN_COMMUNITY_LICENSE_TERRITORY_REVIEW_REQUIRED');
  }
  if (!p.orientationConfirmed) reasons.push('FRONT_AND_UP_ORIENTATION_UNCONFIRMED');
  if (!Array.isArray(p.verifiedReferenceViews) ||
      !(['front','side','back'] as const).every(v => p.verifiedReferenceViews.includes(v))) {
    reasons.push('THREE_PHYSICAL_REFERENCE_VIEWS_REQUIRED');
  }
  if (!Array.isArray(p.vendorDimensionsMm) || p.vendorDimensionsMm.length !== 3 ||
      !p.vendorDimensionsMm.every(n => positiveFinite(n) && n <= 3000) ||
      !Array.isArray(p.rawBoundsUnits) || p.rawBoundsUnits.length !== 3 ||
      !p.rawBoundsUnits.every(positiveFinite)) {
    reasons.push('MEASUREMENTS_INVALID');
  } else {
    const [w, h, d] = p.vendorDimensionsMm;
    const [rw, rh, rd] = p.rawBoundsUnits;
    scale = (h / 1000) / rh;
    bounds = [rw * scale, rh * scale, rd * scale];
    const xError = Math.abs(bounds[0] - w / 1000) / (w / 1000);
    const zError = Math.abs(bounds[2] - d / 1000) / (d / 1000);
    if (xError > PUPSON_STUDIO_STANDARD.maximumDimensionErrorRatio ||
        zError > PUPSON_STUDIO_STANDARD.maximumDimensionErrorRatio) {
      reasons.push('NONUNIFORM_PROPORTIONS_REFUSE_DISTORTION');
    }
  }
  return Object.freeze({
    status: reasons.length ? 'blocked' : 'quarantine-normalization-candidate',
    storefrontApproved: false as const,
    requiresPhysicalAndVisualReview: true as const,
    reasons: Object.freeze(reasons),
    uniformScale: scale,
    normalizedBoundsMeters: bounds,
    studioStandard: PUPSON_STUDIO_STANDARD,
  });
}
