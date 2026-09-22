import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  requireAuthority: vi.fn(),
  createMembership: vi.fn(),
  createReferenceCharacter: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: async () => ({ data: null, error: null }),
      }),
    },
  }),
}));

vi.mock('@/lib/director-project-authority', () => ({
  requireDirectorProjectAuthority: mocks.requireAuthority,
  createDirectorProjectMembership: mocks.createMembership,
}));

vi.mock('@/lib/director-reference-character-service', () => ({
  createDirectorReferenceCharacter: mocks.createReferenceCharacter,
}));

import { POST } from './route';

function request(fields: Record<string,string>, includeReference = true) {
  const form = new FormData();
  for (const [key,value] of Object.entries(fields)) form.set(key,value);
  if (includeReference) {
    form.append('references', new Blob([Buffer.from('test-image')], { type: 'image/png' }), 'reference.png');
  }
  return new Request('http://localhost/api/director/reference-characters', {
    method: 'POST',
    body: form,
  });
}

describe('Director reference-character upload route', () => {
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
    mocks.createMembership.mockResolvedValue({
      projectId: 'created-project',
      userId: '11111111-1111-1111-1111-111111111111',
      role: 'owner',
    });
    mocks.createReferenceCharacter.mockImplementation(async (_client: unknown, input: any) => ({
      projectId: input.projectId,
      characterId: input.characterId,
      cast: {
        displayName: input.displayName,
        continuityRef: `character:${input.characterId}:v1`,
        canonicalAppearanceVariantId: `${input.characterId}:base`,
      },
      bootstrapPlan: { id: 'bootstrap-1' },
      references: [],
    }));
  });

  it('rejects a forged existing project before reference processing', async () => {
    mocks.requireAuthority.mockRejectedValue(new Error('DIRECTOR_PROJECT_ACCESS_DENIED'));

    const response = await POST(request({
      projectId: 'project-foreign',
      displayName: 'Ela',
      characterId: 'ela',
      consent: 'true',
    }));

    expect(response.status).toBe(403);
    expect(mocks.createReferenceCharacter).not.toHaveBeenCalled();
  });

  it('requires explicit reference-processing consent', async () => {
    const response = await POST(request({
      projectId: 'project-a',
      displayName: 'Ela',
      characterId: 'ela',
      consent: 'false',
    }));

    expect(response.status).toBe(400);
    expect(mocks.requireAuthority).not.toHaveBeenCalled();
    expect(mocks.createReferenceCharacter).not.toHaveBeenCalled();
  });

  it('creates an owner-scoped project when Ask has no active project', async () => {
    const response = await POST(request({
      displayName: 'Ela',
      characterId: 'ela',
      consent: 'true',
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mocks.createMembership).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: '11111111-1111-1111-1111-111111111111',
        role: 'owner',
      }),
    );
    expect(mocks.createReferenceCharacter).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: '11111111-1111-1111-1111-111111111111',
        displayName: 'Ela',
        characterId: 'ela',
      }),
    );
    expect(body.referenceCharacter.characterId).toBe('ela');
  });
});
