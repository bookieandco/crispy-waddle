/**
 * Server-side, side-effect-free quarantine gate for proposed product GLBs.
 * Not a generator, an uploader, an asset registry, or release authorization.
 * Keep existing assets/approved and config/product3dModels.ts untouched.
 *
 * The older Python audit_glb.py remains responsible for deeper geometry/
 * texture audits and operator-rendered screenshots after this intake.
 */
import { createHash } from 'node:crypto';

export const PUPSON_3D_GENERATORS = Object.freeze({
  'meshy-api': Object.freeze({
    reference: 'https://docs.meshy.ai/en/api/image-to-3d',
    mode: 'paid-external-api',
    // Linked github.com/meshy-dev/Meshy-guide is DOCUMENTATION, not a runtime.
    requiresExternalDisclosureReview: true,
  }),
  'microsoft-trellis': Object.freeze({
    reference: 'https://github.com/microsoft/TRELLIS',
    mode: 'operator-provisioned-local-gpu',
    requiresExternalDisclosureReview: false,
  }),
  'microsoft-trellis2': Object.freeze({
    reference: 'https://github.com/microsoft/TRELLIS.2',
    mode: 'operator-provisioned-local-gpu',
    requiresExternalDisclosureReview: false,
  }),
} as const);

export type Pupson3DGenerator = keyof typeof PUPSON_3D_GENERATORS;
export interface Pupson3DCandidate {
  // Never the active model filename. New artifacts stay quarantined.
  candidateId: string;
  productId: string;
  generator: Pupson3DGenerator;
  sha256: string;
  // Signed/recorded evidence must be checked by an operator; strings alone
  // make a proposal reviewable, not a model approved for store use.
  inputRightsEvidence: string;
  assetCommercialRightsEvidence: string;
  generatorRunProvenance: string;
  usedCustomerMedia: boolean;
  customerMediaConsentEvidence?: string;
  // Meshy/API spend is NEVER triggered by this function. A receipt may be
  // recorded after separately authorized execution, not inferred from keys.
  executionApprovalEvidence: string;
}

export interface CandidatePreflight {
  quarantineAdmissible: boolean;
  needsHumanReview: true;
  storefrontApproved: false;
  reasons: readonly string[];
  digest: string;
  technical: Readonly<{
    byteLength: number;
    meshCount: number;
    triangleCount: number;
  }>;
}

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_TRIANGLES = 120_000;
const VALID_ID = /^[a-z][a-z0-9-]{1,63}$/;
const VALID_SHA = /^[a-f0-9]{64}$/;

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) && value > 0;
}

function isNonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 8 &&
    value.length <= 4096;
}

/** Strict GLB v2 container/header and a deliberately limited viewer subset.
 * We never fetch external textures, dereference external buffer URIs or
 * execute generator output. Unsupported extensions require manual tooling.
 */
export function preflightProductGlb(
  bytes: Uint8Array,
  proposal: Pupson3DCandidate,
): CandidatePreflight {
  const reasons: string[] = [];
  const digest = createHash('sha256').update(bytes).digest('hex');
  let meshCount = 0;
  let triangleCount = 0;

  if (!VALID_ID.test(proposal.candidateId) || !VALID_ID.test(proposal.productId)) {
    reasons.push('IDENTITY_INVALID');
  }
  if (!Object.prototype.hasOwnProperty.call(PUPSON_3D_GENERATORS, proposal.generator)) {
    reasons.push('GENERATOR_UNRECOGNIZED');
  }
  if (!VALID_SHA.test(proposal.sha256) || proposal.sha256 !== digest) {
    reasons.push('SHA256_MISMATCH');
  }
  if (!isNonempty(proposal.inputRightsEvidence) ||
      !isNonempty(proposal.assetCommercialRightsEvidence) ||
      !isNonempty(proposal.generatorRunProvenance) ||
      !isNonempty(proposal.executionApprovalEvidence)) {
    reasons.push('RIGHTS_OR_EXECUTION_PROVENANCE_REQUIRED');
  }
  if (proposal.usedCustomerMedia && !isNonempty(proposal.customerMediaConsentEvidence)) {
    reasons.push('CUSTOMER_MEDIA_CONSENT_REQUIRED');
  }
  if (!positiveInteger(bytes.length) || bytes.length > MAX_BYTES) {
    reasons.push('SIZE_OUT_OF_BOUNDS');
  }

  if (bytes.length >= 20 && bytes.length <= MAX_BYTES) {
    const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (data.getUint32(0, true) !== 0x46546c67 ||
        data.getUint32(4, true) !== 2 ||
        data.getUint32(8, true) !== bytes.length) {
      reasons.push('GLB_HEADER_INVALID');
    } else {
      const jsonLength = data.getUint32(12, true);
      const jsonType = data.getUint32(16, true);
      if (jsonType !== 0x4e4f534a || jsonLength < 2 ||
          jsonLength % 4 !== 0 || jsonLength > bytes.length - 20) {
        reasons.push('GLB_JSON_CHUNK_INVALID');
      } else {
        try {
          const raw = new TextDecoder('utf-8', { fatal: true })
            .decode(bytes.subarray(20, 20 + jsonLength));
          const gltf = JSON.parse(raw) as Record<string, unknown>;
          const meshes = Array.isArray(gltf.meshes) ? gltf.meshes : [];
          const accessors = Array.isArray(gltf.accessors) ? gltf.accessors : [];
          const materials = Array.isArray(gltf.materials) ? gltf.materials : [];
          const images = Array.isArray(gltf.images) ? gltf.images : [];
          const buffers = Array.isArray(gltf.buffers) ? gltf.buffers : [];
          meshCount = meshes.length;
          if (gltf.asset === null ||
              typeof gltf.asset !== 'object' ||
              (gltf.asset as Record<string, unknown>).version !== '2.0') {
            reasons.push('GLTF_VERSION_INVALID');
          }
          if (meshCount !== 1 || materials.length !== 1 ||
              (meshes[0] as { primitives?: unknown[] } | undefined)?.primitives?.length !== 1) {
            reasons.push('CURRENT_VIEWER_REQUIRES_ONE_MESH_AND_MATERIAL');
          }
          if (Array.isArray(gltf.animations) && gltf.animations.length ||
              Array.isArray(gltf.skins) && gltf.skins.length) {
            reasons.push('UNSUPPORTED_ANIMATION_OR_SKIN');
          }
          if (Array.isArray(gltf.extensionsRequired) && gltf.extensionsRequired.length) {
            reasons.push('REQUIRED_GLTF_EXTENSION_UNREVIEWED');
          }
          if (buffers.length !== 1 || buffers.some((b) =>
            b !== null && typeof b === 'object' && 'uri' in b)) {
            reasons.push('EXTERNAL_OR_MISSING_BUFFER');
          }
          if (images.some((img) =>
            img !== null && typeof img === 'object' && 'uri' in img)) {
            reasons.push('EXTERNAL_IMAGE_URI');
          }
          const primitive = (meshes[0] as { primitives?: unknown[] } | undefined)?.primitives?.[0] as
            | { mode?: unknown; indices?: unknown; attributes?: Record<string, unknown>; material?: unknown }
            | undefined;
          if (primitive) {
            if ((primitive.mode ?? 4) !== 4 || primitive.material !== 0 ||
                !positiveInteger((accessors[primitive.indices as number] as { count?: unknown } | undefined)?.count)) {
              reasons.push('UNSUPPORTED_TRIANGLE_PRIMITIVE');
            } else {
              const indices = (accessors[primitive.indices as number] as { count: number }).count;
              triangleCount = indices / 3;
              if (indices % 3 !== 0 || triangleCount > MAX_TRIANGLES) {
                reasons.push('TRIANGLE_BUDGET_EXCEEDED');
              }
            }
            if (typeof primitive.attributes?.POSITION !== 'number' ||
                typeof primitive.attributes?.NORMAL !== 'number' ||
                typeof primitive.attributes?.TEXCOORD_0 !== 'number') {
              reasons.push('POSITION_NORMAL_UV_REQUIRED');
            }
          }
        } catch {
          reasons.push('GLB_JSON_PARSE_FAILED');
        }
      }
    }
  } else {
    reasons.push('GLB_HEADER_MISSING');
  }
  return {
    quarantineAdmissible: reasons.length === 0,
    needsHumanReview: true,
    storefrontApproved: false,
    reasons: Object.freeze([...new Set(reasons)]),
    digest,
    technical: Object.freeze({ byteLength: bytes.length, meshCount, triangleCount }),
  };
}
