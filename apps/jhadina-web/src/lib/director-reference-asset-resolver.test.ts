import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SupabaseDirectorCharacterReferenceAssetResolver,
  SupabaseDirectorProductReferenceAssetResolver,
} from './director-reference-asset-resolver';

function fakeClient(row: Record<string, unknown> | null) {
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: row, error: null })),
  };
  const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: 'https://signed.example/ref.png' }, error: null }));
  const client = {
    from: vi.fn(() => query),
    storage: { from: vi.fn(() => ({ createSignedUrl })) },
  } as unknown as SupabaseClient;
  return { client, query, createSignedUrl };
}

describe('Director character reference asset resolver', () => {
  it('returns a short-lived URI only for admitted clean references', async () => {
    const fake = fakeClient({
      id: 'ref-1',
      project_id: 'project-a',
      bucket_id: 'director-character-references',
      object_path: 'project-a/ref-1/face.png',
      sha256: 'abc123',
      mime_type: 'image/png',
      admission_status: 'admitted',
      scan_status: 'clean',
    });

    const resolver = new SupabaseDirectorCharacterReferenceAssetResolver(fake.client, 600);
    await expect(resolver.resolve('ref-1','project-a')).resolves.toEqual({
      uri: 'https://signed.example/ref.png',
      sha256: 'abc123',
      mimeType: 'image/png',
    });
    expect(fake.createSignedUrl).toHaveBeenCalledWith('project-a/ref-1/face.png',600);
  });

  it('refuses quarantined media before any signed URL is created', async () => {
    const fake = fakeClient({
      id: 'ref-1',
      project_id: 'project-a',
      bucket_id: 'director-character-references',
      object_path: 'project-a/ref-1/face.png',
      sha256: 'abc123',
      mime_type: 'image/png',
      admission_status: 'quarantined',
      scan_status: 'pending',
    });

    const resolver = new SupabaseDirectorCharacterReferenceAssetResolver(fake.client);
    await expect(resolver.resolve('ref-1','project-a')).rejects.toThrow('DIRECTOR_CHARACTER_REFERENCE_NOT_ADMITTED');
    expect(fake.createSignedUrl).not.toHaveBeenCalled();
  });

  it('scopes product resolution to reference_kind=product', async () => {
    const fake = fakeClient({
      id: 'product-ref-1',
      project_id: 'project-a',
      bucket_id: 'director-reference-media',
      object_path: 'project-a/product-ref-1/hero.png',
      sha256: 'def456',
      mime_type: 'image/png',
      reference_kind: 'product',
      admission_status: 'admitted',
      scan_status: 'clean',
    });

    const resolver = new SupabaseDirectorProductReferenceAssetResolver(fake.client, 600);
    await expect(resolver.resolve('product-ref-1','project-a')).resolves.toMatchObject({
      sha256: 'def456',
      mimeType: 'image/png',
    });
    expect(fake.query.eq).toHaveBeenCalledWith('reference_kind','product');
  });

  it('fails closed for a missing project-scoped reference', async () => {
    const fake = fakeClient(null);
    const resolver = new SupabaseDirectorCharacterReferenceAssetResolver(fake.client);
    await expect(resolver.resolve('ref-foreign','project-a')).rejects.toThrow('DIRECTOR_CHARACTER_REFERENCE_NOT_FOUND');
  });
});
