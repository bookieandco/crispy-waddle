import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  requireAuthority: vi.fn(),
  asset: null as Record<string, unknown> | null,
  signedUrl: vi.fn(),
  scan: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));

vi.mock('@/lib/director-project-authority', () => ({
  requireDirectorProjectAuthority: mocks.requireAuthority,
}));

vi.mock('@/lib/director-reference-media', () => ({
  scanDirectorReferenceMedia: mocks.scan,
}));

function tableQuery(): any {
  const query: any = {
    select: () => query,
    eq: vi.fn(() => query),
    maybeSingle: async () => ({ data: mocks.asset, error: null }),
    update: vi.fn((patch: Record<string, unknown>) => {
      mocks.update(patch);
      return {
        eq: () => ({
          eq: async () => ({ error: null }),
        }),
      };
    }),
  };
  return query;
}

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => ({
    from: () => tableQuery(),
    storage: {
      from: () => ({
        createSignedUrl: mocks.signedUrl,
      }),
    },
  }),
}));

import { POST } from './route';

function request() {
  return new Request('http://localhost/api/director/products/references/product-ref-1/admit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ projectId: 'project-a' }),
  });
}

const context = {
  params: Promise.resolve({ assetId: 'product-ref-1' }),
};

describe('Director product reference admission route', () => {
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
    mocks.asset = {
      id: 'product-ref-1',
      project_id: 'project-a',
      bucket_id: 'director-reference-media',
      object_path: 'project-a/product-ref-1/packnest.png',
      mime_type: 'image/png',
      byte_size: 1024,
      sha256: 'a'.repeat(64),
      reference_kind: 'product',
      admission_status: 'quarantined',
      scan_status: 'pending',
    };
    mocks.signedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.example/product.png' },
      error: null,
    });
    mocks.scan.mockResolvedValue({
      clean: true,
      safe: true,
      evidenceIds: ['scanner:clean:product-ref-1'],
    });
  });

  it('admits a product reference only after a clean media scan', async () => {
    const response = await POST(request(), context);

    expect(response.status).toBe(200);
    expect(mocks.scan).toHaveBeenCalledWith(expect.objectContaining({
      signedUrl: 'https://signed.example/product.png',
      sha256: 'a'.repeat(64),
      mimeType: 'image/png',
    }));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      admission_status: 'admitted',
      scan_status: 'clean',
      scan_evidence_ids: ['scanner:clean:product-ref-1'],
    }));
  });

  it('keeps the reference quarantined when the scanner is not configured', async () => {
    mocks.scan.mockRejectedValue(new Error('DIRECTOR_MEDIA_SCANNER_NOT_CONFIGURED'));

    const response = await POST(request(), context);

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: 'DIRECTOR_MEDIA_SCANNER_NOT_CONFIGURED',
      admissionStatus: 'quarantined',
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('rejects unsafe product media and records scan evidence', async () => {
    mocks.scan.mockResolvedValue({
      clean: false,
      safe: false,
      evidenceIds: ['scanner:unsafe:product-ref-1'],
      reason: 'unsafe-content',
    });

    const response = await POST(request(), context);

    expect(response.status).toBe(422);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      admission_status: 'rejected',
      scan_status: 'unsafe',
      scan_evidence_ids: ['scanner:unsafe:product-ref-1'],
      rejection_reason: 'unsafe-content',
    }));
  });
});
