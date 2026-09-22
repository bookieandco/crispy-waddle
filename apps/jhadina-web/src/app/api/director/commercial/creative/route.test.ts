import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  requireAuthority: vi.fn(),
  productBibleRow: null as Record<string, unknown> | null,
  productBibleError: null as { message: string } | null,
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));

vi.mock('@/lib/director-project-authority', () => ({
  requireDirectorProjectAuthority: mocks.requireAuthority,
}));

function queryFor(table: string): any {
  const query: any = {
    select: () => query,
    eq: vi.fn(() => query),
    maybeSingle: async () => ({
      data: table === 'director_product_bibles' ? mocks.productBibleRow : null,
      error: table === 'director_product_bibles' ? mocks.productBibleError : null,
    }),
  };
  return query;
}

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      mocks.from(table);
      return queryFor(table);
    },
    rpc: mocks.rpc,
  }),
}));

import { POST } from './route';

const productBible = {
  id: 'product-bible:project-a:packnest:v1',
  projectId: 'project-a',
  productId: 'packnest',
  displayName: 'PackNest',
  canonicalVariantId: 'product-variant:packnest:base',
  referenceViews: [{
    id: 'view:front',
    assetId: 'product-ref-1',
    sha256: 'a'.repeat(64),
    view: 'front',
    evidenceIds: ['scanner:clean:product-ref-1'],
  }],
  labelAuthorities: [{
    id: 'label:front',
    assetId: 'product-ref-1',
    sha256: 'a'.repeat(64),
    text: 'PACKNEST',
    surface: 'front',
    evidenceIds: ['label:verified'],
  }],
  immutableTraits: ['preserve packaging geometry'],
  claimEvidenceIds: [],
  rightsEvidenceIds: ['rights:owned'],
};

const styleBible = {
  id: 'style-bible:project-a:v1',
  projectId: 'project-a',
  referenceAssetIds: ['style-ref-1'],
  referenceSha256s: ['b'.repeat(64)],
  styleBlock: 'Clean travel-product studio photography.',
  lightingRules: ['soft directional'],
  paletteRules: ['neutral'],
  lensAndCameraRules: ['50mm product perspective'],
  textureRules: ['realistic fabric'],
  forbiddenDrift: ['do not change product colors'],
  evidenceIds: ['style:approved'],
};

const concept = {
  id: 'creative:packnest:1',
  projectId: 'project-a',
  productBibleId: productBible.id,
  styleBibleId: styleBible.id,
  platform: 'instagram' as const,
  aspectRatio: '4:5' as const,
  targetRuntimeSeconds: 15,
  hookType: 'demonstration' as const,
  bigIdeaRef: 'big-idea:compression',
  audienceHypothesisRef: 'audience:travelers',
  concept: 'Show the cube compressing a bulky stack of clothes.',
  benefitClaimRefs: [],
  beats: [{
    startSeconds: 0,
    endSeconds: 3,
    purpose: 'hook' as const,
    action: 'Show overflowing suitcase before compression.',
    productRequired: true,
  }, {
    startSeconds: 3,
    endSeconds: 12,
    purpose: 'demonstration' as const,
    action: 'Zip and compress PackNest.',
    productRequired: true,
  }, {
    startSeconds: 12,
    endSeconds: 15,
    purpose: 'cta' as const,
    action: 'Show final packed suitcase.',
    productRequired: true,
  }],
  evidenceIds: ['research:meta-pattern-1'],
};

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/director/commercial/creative', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Director commercial creative route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: '11111111-1111-1111-1111-111111111111' } },
    });
    mocks.requireAuthority.mockResolvedValue({
      projectId: 'project-a',
      userId: '11111111-1111-1111-1111-111111111111',
      role: 'owner',
    });
    mocks.productBibleRow = {
      id: productBible.id,
      project_id: 'project-a',
      product_id: 'packnest',
      canonical_variant_id: productBible.canonicalVariantId,
      bible: productBible,
    };
    mocks.productBibleError = null;
    mocks.rpc.mockResolvedValue({
      data: { id: concept.id, project_id: 'project-a' },
      error: null,
    });
  });

  it('uses the persisted Product Bible and passes only its id into the durable creative write', async () => {
    const response = await POST(request({
      projectId: 'project-a',
      productBibleId: productBible.id,
      styleBible,
      concept,
      sourceContentProjectId: 'social-project:1',
      sourceSocialAssetId: 'social-asset:1',
    }));

    expect(response.status).toBe(201);
    expect(mocks.from).toHaveBeenCalledWith('director_product_bibles');
    const [rpcName, args] = mocks.rpc.mock.calls[0]!;
    expect(rpcName).toBe('save_director_commercial_creative_bundle');
    expect(args.p_product_bible_id).toBe(productBible.id);
    expect(args.p_product_bible).toBeUndefined();
    expect(args.p_concept).toMatchObject({
      id: concept.id,
      productBibleId: productBible.id,
      authority: 'CREATIVE_PLAN_ONLY',
    });
  });

  it('fails closed when the requested Product Bible is not persisted for the project', async () => {
    mocks.productBibleRow = null;

    const response = await POST(request({
      projectId: 'project-a',
      productBibleId: productBible.id,
      styleBible,
      concept,
    }));

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'DIRECTOR_AD_PRODUCT_BIBLE_NOT_FOUND' });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('rejects a malformed persisted Product Bible instead of trusting its id alone', async () => {
    mocks.productBibleRow = {
      id: productBible.id,
      project_id: 'project-a',
      product_id: 'packnest',
      canonical_variant_id: productBible.canonicalVariantId,
      bible: { ...productBible, referenceViews: [], rightsEvidenceIds: [] },
    };

    const response = await POST(request({
      projectId: 'project-a',
      productBibleId: productBible.id,
      styleBible,
      concept,
    }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('DIRECTOR_AD_BIBLE_INVALID');
    expect(body.productErrors).toContain('DIRECTOR_AD_PRODUCT_REFERENCE_REQUIRED');
    expect(body.productErrors).toContain('DIRECTOR_AD_PRODUCT_RIGHTS_REQUIRED');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('checks project edit authority before reading the Product Bible', async () => {
    mocks.requireAuthority.mockRejectedValue(new Error('DIRECTOR_PROJECT_ACCESS_DENIED'));

    const response = await POST(request({
      projectId: 'project-a',
      productBibleId: productBible.id,
      styleBible,
      concept,
    }));

    expect(response.status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalledWith('director_product_bibles');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
