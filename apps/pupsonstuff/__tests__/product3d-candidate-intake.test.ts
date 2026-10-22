import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  PUPSON_3D_GENERATORS,
  preflightProductGlb,
  type Pupson3DCandidate,
} from '../lib/product3d/candidate-intake';

const base = {
  asset: { version: '2.0' },
  buffers: [{ byteLength: 64 }],
  meshes: [{ primitives: [{
    indices: 0,
    material: 0,
    attributes: { POSITION: 1, NORMAL: 2, TEXCOORD_0: 3 },
  }] }],
  materials: [{ name: 'sample-fabric' }],
  accessors: [
    { count: 600, type: 'SCALAR', componentType: 5123 },
    { count: 200, type: 'VEC3', componentType: 5126 },
    { count: 200, type: 'VEC3', componentType: 5126 },
    { count: 200, type: 'VEC2', componentType: 5126 },
  ],
};

function glb(json: Record<string, unknown> = base) {
  const encoded = Buffer.from(JSON.stringify(json), 'utf8');
  const padding = (4 - (encoded.length % 4)) % 4;
  const jsonData = Buffer.concat([encoded, Buffer.alloc(padding, 0x20)]);
  const binary = Buffer.alloc(64);
  const length = 12 + 8 + jsonData.length + 8 + binary.length;
  const result = Buffer.alloc(12);
  result.write('glTF', 0, 'ascii');
  result.writeUInt32LE(2, 4);
  result.writeUInt32LE(length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonData.length, 0);
  jsonHeader.write('JSON', 4, 'ascii');
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binary.length, 0);
  binHeader.write('BIN\0', 4, 'ascii');
  return Buffer.concat([result, jsonHeader, jsonData, binHeader, binary]);
}
function candidate(data: Uint8Array, overrides: Partial<Pupson3DCandidate> = {}): Pupson3DCandidate {
  return {
    candidateId: 'hoodie-candidate-01',
    productId: 'hoodie',
    generator: 'microsoft-trellis',
    sha256: createHash('sha256').update(data).digest('hex'),
    inputRightsEvidence: 'operator verified source photography rights',
    assetCommercialRightsEvidence: 'operator verified generated asset commercial rights',
    generatorRunProvenance: 'immutable model-run receipt recorded',
    executionApprovalEvidence: 'operator authorized one source-only test',
    usedCustomerMedia: false,
    ...overrides,
  };
}
describe('new 3D candidates cannot replace approved boutique product GLBs', () => {
  it('accepts a supported quarantined GLB only for manual review', () => {
    const file = glb();
    const result = preflightProductGlb(file, candidate(file));
    expect(result.quarantineAdmissible).toBe(true);
    expect(result.storefrontApproved).toBe(false);
    expect(result.needsHumanReview).toBe(true);
    expect(result.technical.triangleCount).toBe(200);
  });
  it('allows only canonical generator identities; disallows Trellis-3d marketing repo', () => {
    expect(PUPSON_3D_GENERATORS['microsoft-trellis'].reference)
      .toBe('https://github.com/microsoft/TRELLIS');
    const file = glb();
    const result = preflightProductGlb(file, candidate(file, {
      generator: 'Trellis-3d/Trellis-3D' as Pupson3DCandidate['generator'],
    }));
    expect(result.reasons).toContain('GENERATOR_UNRECOGNIZED');
  });
  it('fails closed on missing rights, execution receipts or customer image consent', () => {
    const file = glb();
    const result = preflightProductGlb(file, candidate(file, {
      inputRightsEvidence: '',
      assetCommercialRightsEvidence: '',
      executionApprovalEvidence: '',
      usedCustomerMedia: true,
    }));
    expect(result.reasons).toContain('RIGHTS_OR_EXECUTION_PROVENANCE_REQUIRED');
    expect(result.reasons).toContain('CUSTOMER_MEDIA_CONSENT_REQUIRED');
    expect(result.storefrontApproved).toBe(false);
  });
  it('detects modified/truncated binaries without fetching anything', () => {
    const file = glb();
    expect(preflightProductGlb(file, candidate(file, { sha256: '0'.repeat(64) }))
      .reasons).toContain('SHA256_MISMATCH');
    const truncated = file.subarray(0, file.length - 5);
    expect(preflightProductGlb(truncated, candidate(truncated)).reasons)
      .toContain('GLB_HEADER_INVALID');
  });
  it('rejects out-of-policy geometry and images fetched from the Internet', () => {
    const asset = { ...base, images: [{ uri: 'https://untrusted.invalid/mug.png' }] };
    const file = glb(asset);
    expect(preflightProductGlb(file, candidate(file)).reasons)
      .toContain('EXTERNAL_IMAGE_URI');
    const many = {
      ...base,
      accessors: [
        { count: 400_000, type: 'SCALAR', componentType: 5125 },
        ...base.accessors.slice(1),
      ],
    };
    const large = glb(many);
    expect(preflightProductGlb(large, candidate(large)).reasons)
      .toContain('TRIANGLE_BUDGET_EXCEEDED');
  });
  it('refuses multi-mesh, unsupported extensions and glTF features', () => {
    const unsupported = { ...base,
      meshes: [base.meshes[0], base.meshes[0]],
      extensionsRequired: ['KHR_draco_mesh_compression'],
      animations: [{}],
    };
    const data = glb(unsupported);
    const reasons = preflightProductGlb(data, candidate(data)).reasons;
    expect(reasons).toContain('CURRENT_VIEWER_REQUIRES_ONE_MESH_AND_MATERIAL');
    expect(reasons).toContain('REQUIRED_GLTF_EXTENSION_UNREVIEWED');
    expect(reasons).toContain('UNSUPPORTED_ANIMATION_OR_SKIN');
  });
  it('does not confuse a guide repo MIT code license with permission to use output assets', () => {
    const file = glb();
    const r = preflightProductGlb(file, candidate(file, {
      generator: 'meshy-api',
      assetCommercialRightsEvidence: '',
    }));
    expect(r.quarantineAdmissible).toBe(false);
    expect(r.reasons).toContain('RIGHTS_OR_EXECUTION_PROVENANCE_REQUIRED');
  });
});
