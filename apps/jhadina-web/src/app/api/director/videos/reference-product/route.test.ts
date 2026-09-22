import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  requireAuthority: vi.fn(),
  bibleRow: null as Record<string, unknown> | null,
  resolve: vi.fn(),
  createVideo: vi.fn(),
  inspectIntent: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));

vi.mock('@/lib/director-project-authority', () => ({
  requireDirectorProjectAuthority: mocks.requireAuthority,
}));

function query(): any {
  const q: any = {
    select: () => q,
    eq: vi.fn(() => q),
    order: () => q,
    limit: () => q,
    maybeSingle: async () => ({ data: mocks.bibleRow, error: null }),
  };
  return q;
}

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => ({
    from: () => query(),
  }),
}));

vi.mock('@/lib/director-reference-asset-resolver', () => ({
  SupabaseDirectorProductReferenceAssetResolver: class {
    async resolve(assetId: string, projectId: string) {
      return mocks.resolve(assetId, projectId);
    }
  },
}));

vi.mock('@/lib/director-video-job-service', () => ({
  inspectAskVideoIntent: (...args: unknown[]) => mocks.inspectIntent(...args),
  createAndSubmitAskVideoJob: (...args: unknown[]) => mocks.createVideo(...args),
}));

import { POST } from './route';

const bible = {
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

function request(overrides: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/director/videos/reference-product', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      projectId: 'project-a',
      productId: 'packnest',
      productBibleId: bible.id,
      prompt: 'Create a short product demonstration for Instagram.',
      ...overrides,
    }),
  });
}

describe('Director reference-product video route', () => {
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
    mocks.bibleRow = {
      id: bible.id,
      project_id: 'project-a',
      product_id: 'packnest',
      canonical_variant_id: bible.canonicalVariantId,
      bible,
    };
    mocks.resolve.mockResolvedValue({
      uri: 'https://signed.example/product-ref-1.png',
      sha256: 'a'.repeat(64),
      mimeType: 'image/png',
    });
    mocks.inspectIntent.mockReturnValue({
      mode: 'short',
      prompt: 'Create a short product demonstration for Instagram.',
      aspectRatio: '9:16',
      narration: true,
      captions: true,
      foley: true,
      commercialSafeOnly: true,
      providerPolicy: { localFreeFirst: true, allowPaidWithoutApproval: false },
    });
    mocks.createVideo.mockResolvedValue({
      job: {
        id: 'video:product-1',
        projectId: 'project-a',
        status: 'queued',
      },
    });
  });

  it('resolves signed product references and passes the locked Product Bible into Director', async () => {
    const response = await POST(request());

    expect(response.status).toBe(202);
    expect(mocks.resolve).toHaveBeenCalledWith('product-ref-1', 'project-a');
    expect(mocks.createVideo).toHaveBeenCalledWith(expect.objectContaining({
      userId: '11111111-1111-1111-1111-111111111111',
      activeProject: 'project-a',
      referenceProduct: {
        productId: 'packnest',
        productBibleId: bible.id,
        canonicalVariantId: bible.canonicalVariantId,
        referenceAssetIds: ['product-ref-1'],
        referenceSha256s: ['a'.repeat(64)],
        referenceUris: ['https://signed.example/product-ref-1.png'],
        labelAuthorities: [{ text: 'PACKNEST', surface: 'front' }],
      },
    }));
  });

  it('fails closed when the persisted Product Bible is missing', async () => {
    mocks.bibleRow = null;

    const response = await POST(request());

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'DIRECTOR_PRODUCT_BIBLE_NOT_FOUND' });
    expect(mocks.createVideo).not.toHaveBeenCalled();
  });

  it('returns a governed block when no product-reference-aware provider can run the job', async () => {
    mocks.createVideo.mockResolvedValue({
      job: {
        id: 'video:product-blocked',
        projectId: 'project-a',
        status: 'blocked',
        error: 'DIRECTOR_PRODUCT_VIDEO_PROVIDER_NOT_CONFIGURED',
      },
    });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('DIRECTOR_PRODUCT_VIDEO_PROVIDER_NOT_CONFIGURED');
    expect(body.requirement).toContain('product-reference-aware Director video provider');
  });
});
