import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveOwnedCreativeAsset, downloadOwnedCreativeImage } from '../lib/creative-media';
import { createSignedAssetUrl, rest } from '../lib/platform';

vi.mock('../lib/platform', () => ({
  ownerTokenHash: (token:string) => createHash('sha256').update(token).digest('hex'),
  rest:vi.fn(),
  createSignedAssetUrl:vi.fn(),
}));

const outputId='00000000-0000-4000-8000-000000000001';
const jobId='00000000-0000-4000-8000-000000000002';
const assetId='00000000-0000-4000-8000-000000000003';
const hash=createHash('sha256').update('owner-cookie-a').digest('hex');
const path=`${hash}/${jobId}/${assetId}.png`;
const owned = [{
  id:outputId,
  job:{owner_token_hash:hash},
  generated_asset:{bucket_id:'pupson-creative',object_path:path,mime_type:'image/png'},
}];

beforeEach(() => {
  vi.mocked(rest).mockReset();
  vi.mocked(createSignedAssetUrl).mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('private owner-bound creative-image delivery', () => {
  it('refuses malformed output IDs without touching service-role database', async () => {
    expect(await resolveOwnedCreativeAsset('all-outputs','owner-cookie-a')).toBeNull();
    expect(rest).not.toHaveBeenCalled();
  });
  it('queries PostgREST using the hashed owner cookie and never an unscoped output', async () => {
    vi.mocked(rest).mockResolvedValueOnce(owned);
    const asset=await resolveOwnedCreativeAsset(outputId,'owner-cookie-a');
    expect(asset).toEqual({bucket:'pupson-creative',path});
    const query=String(vi.mocked(rest).mock.calls[0][0]);
    expect(query).toContain('job.owner_token_hash=eq.'+hash);
    expect(query).toContain('id=eq.'+outputId);
  });
  it('rejects cross-owner and nonprivate storage records before signing', async () => {
    vi.mocked(rest).mockResolvedValueOnce([]);
    expect(await downloadOwnedCreativeImage(outputId,'owner-cookie-b')).toBeNull();
    vi.mocked(rest).mockResolvedValueOnce([{
      ...owned[0],
      generated_asset:{...owned[0].generated_asset,bucket_id:'public'},
    }]);
    expect(await downloadOwnedCreativeImage(outputId,'owner-cookie-a')).toBeNull();
    expect(createSignedAssetUrl).not.toHaveBeenCalled();
  });
  it('returns image bytes via a very short server-only signing window', async () => {
    const png = Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);
    vi.mocked(rest).mockResolvedValueOnce(owned);
    vi.mocked(createSignedAssetUrl).mockResolvedValueOnce('https://private.example/signed');
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
      ok:true,headers:new Headers({'content-type':'image/png'}),
      arrayBuffer:async()=>png.buffer.slice(png.byteOffset,png.byteOffset+png.byteLength),
    }));
    expect(await downloadOwnedCreativeImage(outputId,'owner-cookie-a')).toEqual(new Uint8Array(png));
    expect(createSignedAssetUrl).toHaveBeenCalledWith('pupson-creative',path,60);
  });
});
