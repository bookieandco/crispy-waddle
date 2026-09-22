import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  requireAuthority: vi.fn(),
  existing: null as Record<string, unknown> | null,
  inserted: null as Record<string, unknown> | null,
  upload: vi.fn(),
  remove: vi.fn(),
  fromTable: vi.fn(),
  storageFrom: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));

vi.mock('@/lib/director-project-authority', () => ({
  requireDirectorProjectAuthority: mocks.requireAuthority,
}));

function tableQuery(table: string): any {
  const query: any = {
    select: () => query,
    eq: vi.fn(() => query),
    maybeSingle: async () => ({ data: table === 'director_reference_media_assets' ? mocks.existing : null, error: null }),
    insert: vi.fn((row: Record<string, unknown>) => {
      mocks.inserted = row;
      return {
        select: () => ({
          single: async () => ({
            data: { ...row, created_at: '2026-09-22T12:00:00.000Z' },
            error: null,
          }),
        }),
      };
    }),
  };
  return query;
}

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      mocks.fromTable(table);
      return tableQuery(table);
    },
    storage: {
      from: (bucket: string) => {
        mocks.storageFrom(bucket);
        return {
          upload: mocks.upload,
          remove: mocks.remove,
        };
      },
    },
  }),
}));

import { POST } from './route';

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a],0);
  bytes.set([0x00,0x00,0x00,0x0d],8);
  bytes.set([0x49,0x48,0x44,0x52],12);
  bytes[16]=(width>>>24)&0xff; bytes[17]=(width>>>16)&0xff; bytes[18]=(width>>>8)&0xff; bytes[19]=width&0xff;
  bytes[20]=(height>>>24)&0xff; bytes[21]=(height>>>16)&0xff; bytes[22]=(height>>>8)&0xff; bytes[23]=height&0xff;
  return bytes;
}

function request(): Request {
  const form = new FormData();
  form.set('projectId', 'project-a');
  form.set('rightsRef', 'rights:owned');
  form.set('viewHint', 'front');
  form.set('file', new File([png(1024,768)], 'packnest.png', { type: 'image/png' }));
  return new Request('http://localhost/api/director/products/references', {
    method: 'POST',
    body: form,
  });
}

describe('Director product reference upload route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.existing = null;
    mocks.inserted = null;
    mocks.getUser.mockResolvedValue({
      data: { user: { id: '11111111-1111-1111-1111-111111111111' } },
    });
    mocks.requireAuthority.mockResolvedValue({
      projectId: 'project-a',
      userId: '11111111-1111-1111-1111-111111111111',
      role: 'owner',
    });
    mocks.upload.mockResolvedValue({ error: null });
    mocks.remove.mockResolvedValue({ error: null });
  });

  it('uploads quarantined product media into the private product-reference bucket with product identity', async () => {
    const response = await POST(request());

    expect(response.status).toBe(201);
    expect(mocks.storageFrom).toHaveBeenCalledWith('director-reference-media');
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.inserted).toMatchObject({
      project_id: 'project-a',
      reference_kind: 'product',
      view_hint: 'front',
      rights_ref: 'rights:owned',
      admission_status: 'quarantined',
      scan_status: 'pending',
    });
  });

  it('deduplicates only against product references in the same project', async () => {
    mocks.existing = {
      id: 'product-ref:existing',
      project_id: 'project-a',
      reference_kind: 'product',
      sha256: 'same',
      admission_status: 'admitted',
      scan_status: 'clean',
    };

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ deduplicated: true });
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('checks project authority before storing bytes', async () => {
    mocks.requireAuthority.mockRejectedValue(new Error('DIRECTOR_PROJECT_ACCESS_DENIED'));

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.inserted).toBeNull();
  });
});
